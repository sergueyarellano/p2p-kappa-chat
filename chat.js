const network = require('hyperswarm')
const kappacore = require('kappa-core')
const list = require('kappa-view-list')
const memdb = require('memdb')
const chalk = require('chalk')
const argv = require('minimist')(process.argv.slice(2))
const pump = require('pump')
const crypto = require('crypto')
const { log, slug, getIPV4FromIPV6 } = require('./helpers')
const store = require('./store')
const publicIP = require('public-ip')
const through = require('through2')
let readOnce = 0

// Very basic command-line argument validation
if (!argv.t) {
  throw new Error('Provide "-t mytopic" to command line')
}
if (!argv.n) {
  throw new Error('Provide "-n nickname" to command line')
}

const ui = require('./ui')() // Let's start the ui first
const swarm = network()

// Constants.
// ==========

const topic = argv.t
const topicSlug = slug(topic)
const nickname = slug(argv.n)

// The discovery key is a 32-byte hash based on the topic slug.
const topicDiscoveryKey = crypto.createHash('sha256').update(topicSlug).digest()

// Views.
// ======

// A list of messages, lexographically ordered by timestamp.
const timestampView = list(memdb(), function (msg, next) {
  if (!msg.value.timestamp) return next()
  next(null, [msg.value.timestamp])
})

// Kappa Core.
// ===========

// Set up kappa-core. This is a database based on logs
// Kappa core retrieves every feed replicated in your machine and generates a view.
// We are sorting that view by timestamp
const databasePath = `./multi-chat-${topicSlug}-${nickname}`
const core = kappacore(databasePath, { valueEncoding: 'json' })

core.use('chats', timestampView)

// Note: the data value is in the 'value' property.
function readOldmessages () {
  core.api.chats.read({ reverse: true, limit: 50 }, function (err, msgs) {
    if (err) throw err
    // log to the console
    msgs.reverse().forEach(function (data, i) {
      if (data.value.type === 'chat-message') {
        log(`💫 ${data.value.nickname}: ${data.value.text}`, new Date(data.value.timestamp))
      }
    })
  })
}
// Note: unlike multifeed, kappa-core takes the name of a view (or views)
// ===== in its ready function. The function will fire when the view (or views)
//       has caught up.
core.ready('chats', async function () {
  const ourPublicIP = await publicIP.v4()
  store.set('user.publicIP', ourPublicIP)
  // For any newly-received messages, show them as they arrive.
  // Note: Here, data is returned as an array of objects.
  core.api.chats.tail(1, (data) => {
    // console.log('data: ', JSON.stringify(data, null, 2))
    if (data[0].value.type === 'chat-message') {
      const feedNickname = data[0].value.nickname
      // When local user enters a message we don't want to show that message twice: prompt and formatted log
      // for ui we are using "serverline", it leaves "last prompt" on the screen already.
      // Just check here if the local nickname used is the same as the feed.
      // That way we now it is comming from local feed and then we will not display anything
      nickname !== feedNickname && log(`💬 ${chalk.green(data[0].value.nickname)}: ${data[0].value.text}`, new Date(data[0].value.timestamp))
    }
  })
  core.api.chats.onInsert(function (msg) {
    if (msg.value.type === 'about') {
      msg.value.text === 'CONNECTED' && store.updateUser(msg.value)
    }
  })

  core.writer('local', (err, feed) => {
    if (err) throw err
    log('Local feed is ready.')

    swarm.on('connection', async (socket, details) => {
      // add new connections
      details.client && store.addUser(details.peer)

      if (!details.client) {
        // We say that we are connected every time a peer connection is established
        // TODO: should we use a kv view in another writer instead of polluting this writer?
        const address = socket.address()
        feed.append({
          type: 'about',
          nickname,
          data: {
            host: getIPV4FromIPV6(address.address),
            port: address.port,
            publicIP: ourPublicIP,
            nickname
          },
          text: 'CONNECTED',
          timestamp: new Date().toISOString() // it is important that timestamp is same format as
        })
      }

      // Start replicating the core with the newly-discovered socket.
      // Live option maintains stream open awaiting for new info from socket
      // Through is a transform stream we use to read old messages once connection is open and started replicating
      pump(socket, core.replicate(details.client, { live: true }), through(function (chunk, _, next) {
        // Read all messages when we have a local copy
        // TODO: find a better way to make sure that old messages that were produced while we
        // weren't there, are displayed after we replicate them in our hypercore.
        // The problem is that we don't know when are they replicated, just when they started replicating.
        readOnce++ === 0 && setTimeout(readOldmessages, 500)
        next(null, chunk)
      }), socket)
    })

    swarm.on('disconnection', (socket, info) => info.client && store.removeUser(info.peer))

    // When we press enter, serverline will handle the process.stdin.
    // we catch the event, format the line and log it
    ui.appendOnEnter(feed)
    // Note: it’s important to join the swarm only once
    // the local writer has been created so that when we
    // get the 'connection' event on the swarm, our local
    // feed is included in the list of feeds that multifeed
    // replicates. Otherwise, on first run, the symptom is
    // that the feeds do not appear to replicate but work
    // on subsequent runs.
    swarm.join(topicDiscoveryKey, {
      lookup: true, // find and connect to peers.
      announce: true // optional: announce self as a connection target.
    })
  })
})
