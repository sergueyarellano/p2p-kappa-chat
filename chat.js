const network = require('hyperswarm')
const kappacore = require('kappa-core')
const list = require('kappa-view-list')
const memdb = require('memdb')
const chalk = require('chalk')
const argv = require('minimist')(process.argv.slice(2))
const pump = require('pump')
const crypto = require('crypto')
const { log, slug } = require('./helpers')

// Very basic command-line argument validation
if (!argv.t) {
  throw new Error('Provide "-t mytopic" to command line')
}
if (!argv.n) {
  throw new Error('Provide "-n nickname" to command line')
}

const ui = require('./ui')() // Let's start the ui first

// Constants.
// ==========

const topic = argv.t
const topicSlug = slug(topic)
const nickname = slug(argv.n)

// The discovery key is a 32-byte hash based on the topic slug.
const topicDiscoveryKey = crypto.createHash('sha256').update(topicSlug).digest()

// Discovery and replication.
// ==========================

// Set up hyperswarm network.
const swarm = network()

swarm.on('connection', (socket, details) => {
  // Note details.peer is null if details.client === false
  let locality = 'n/a'
  let host = 'n/a'
  let port = 'n/a'
  if (details.client) {
    locality = details.peer.local ? 'LAN' : 'WAN'
    host = details.peer.host
    port = details.peer.port
  }
  const clientType = details.client ? 'we initiated' : 'they initiated'

  log(`📡 Connected: (${details.type}) ${host}:${port} (${locality}, ${clientType} connection)`)
  log(`📜 Count: ${core.feeds().length}`)

  // Start replicating the core with the newly-discovered socket.
  // Live option maintains stream open awaiting for new info from socket
  pump(socket, core.replicate(details.client, { live: true }), socket)
})

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
core.api.chats.read({ reverse: true, limit: 50 }, function (err, msgs) {
  if (err) throw err
  // log to the console
  // view.update({ nickname: 'debug', text: 'new message', timestamp: new Date().toISOString() })
  msgs.reverse().forEach(function (data, i) {
    log(`💫 ${data.value.nickname}: ${data.value.text}`, new Date(data.value.timestamp))
    // view.update(data.value)
  })
})
// Note: unlike multifeed, kappa-core takes the name of a view (or views)
// ===== in its ready function. The function will fire when the view (or views)
//       has caught up.
core.ready('chats', function () {
  // For any newly-received messages, show them as they arrive.
  // Note: Here, data is returned as an array of objects.
  core.api.chats.tail(1, (data) => {
    const feedNickname = data[0].value.nickname
    // When local user enters a message we don't want to show that message twice: prompt and formatted log
    // for ui we are using "serverline", it leaves "last prompt" on the screen already.
    // Just check here if the local nickname used is the same as the feed.
    // That way we now it is comming from local feed and then we will not display anything
    nickname !== feedNickname && log(`💬 ${chalk.green(data[0].value.nickname)}: ${data[0].value.text}`, new Date(data[0].value.timestamp))
  })

  core.writer('local', (err, feed) => {
    if (err) throw err
    log('Local feed is ready.')

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
