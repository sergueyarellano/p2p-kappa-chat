const memdb = require('memdb')
const kappa = require('kappa-core')
const crypto = require('crypto')
const hyperswarm = require('hyperswarm')
const list = require('kappa-view-list')
const pump = require('pump')
const argv = require('minimist')(process.argv.slice(2))
// const view = require('./ui')

if (!argv.t) {
  throw new Error('Provide "-t mytopic" to command line')
}
if (!argv.n) {
  throw new Error('Provide "-n nickname" to command line')
}
// Constants
// =========
const topic = argv.t
const HashedTopic = crypto.createHash('sha256')
  .update(argv.t)
  .digest()

const node = argv.n
const dateAtStart = Date.now()

// Views
// =====
const timestampView = list(memdb(), function (msg, next) {
  if (!msg.value.timestamp) return next()
  next(null, [msg.value.timestamp])
})

// Discovery and replication
// =========================

const swarm = hyperswarm()

swarm.on('connection', function (socket, details) {
  console.log('details: ', details.client)
  pump(socket, core.replicate(details.client, { live: true }), socket)
})

// Kappa core
// ==========
const dbPath = './multichat' + topic + node
const core = kappa(dbPath, { valueEncoding: 'json' })

core.use('chats', timestampView)

core.api.chats.read({ reverse: true, limit: 5 }).on('data', (data) => {
  // view.update(data.value)
  console.log('old message', data.value.text)
})

core.ready('chats', function () {
  const feeds = core.feeds()
  // log to the console
  // view.update({ nickname: 'feeds', text: feeds.length, timestamp: new Date().toISOString() })
  console.log('feeds', feeds.length)

  // // first log the last x chats
  core.api.chats.read({ reverse: true, limit: 1 }, function (err, msgs) {
    if (err) throw err
    // log to the console
    // view.update({ nickname: 'debug', text: 'new message', timestamp: new Date().toISOString() })
    msgs.reverse().forEach(function (data, i) {
      console.log('new message:', data.value.text)
      // view.update(data.value)
    })
  })

  // iterate over each feed that exists locally..
  // feeds.forEach(function (feed) {
  //   // feed is a hypercore! (remember reading from hypercores in previous exercises?)
  //   feed.createReadStream({ live: true })
  //     .on('data', function (data) {
  //       console.log('data', data.timestamp, data.text)
  //       // // Log only new messages, not old entries
  //       // const chatDate = Date.parse(data.timestamp)
  //       // if (dateAtStart < chatDate) {
  //       //   view.update(data)
  //       // }
  //     })
  // })
  // // // listen for new feeds that might be shared with us during runtime..
  // core.on('feed', function (feed) {
  //   feed.createReadStream({ live: true })
  //     .on('data', function (data) {
  //       view.update(data)
  //     })
  // })

  core.writer('local', function (err, feed) {
    if (err) throw err
    // console.log('prepared')
    // view.onEnter(appendLine)

    process.stdin.on('data', (data) => {
      feed.append({
        type: 'chat-message',
        nickname: argv.n,
        text: data.toString(),
        timestamp: new Date().toISOString()
      })
    })
    // function appendLine (line) {
    //   feed.append({
    //     type: 'chat-message',
    //     nickname: argv.n,
    //     text: line,
    //     timestamp: new Date().toISOString()
    //   })
    // }
    swarm.join(HashedTopic, {
      lookup: true, // find & connect to peers
      announce: true
    }, function () {
      // log to the console
      console.log('swarm joined')

      // view.update({ nickname: 'swarm', text: 'joined', timestamp: new Date().toISOString() })
    })
  })
})
