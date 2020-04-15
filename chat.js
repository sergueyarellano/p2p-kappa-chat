const blit = require('txt-blit')
const chalk = require('chalk')
const network = require('hyperswarm')
const kappacore = require('kappa-core')
const list = require('kappa-view-list')
const memdb = require('memdb')
const argv = require('minimist')(process.argv.slice(2))
const pump = require('pump')
const crypto = require('crypto')
const myRL = require('serverline')
// TOOD: https://github.com/SBoudrias/Inquirer.js#layouts

myRL.init()

myRL.setCompletion(['help', 'command1', 'command2', 'login', 'check', 'ping'])

myRL.setPrompt(chalk.magenta(`@${argv.n}> `))

// Very basic command-line argument validation
if (!argv.t) {
  throw new Error('Provide "-t mytopic" to command line')
}
if (!argv.n) {
  throw new Error('Provide "-n nickname" to command line')
}

// Helpers.
// ========

// Returns a formatted time stamp from the passed date (or the current date)
const formattedDate = (date = new Date()) => `${date.toLocaleDateString('en-CA')} ${date.toLocaleTimeString('en-CA')}`

// Log to console with a timestamp prefix.
const log = (msg, date = new Date()) => console.log(`${formattedDate(date)}: ${msg}`)

// “Sluggifies” the passed string: removes spaces and replaces inter-word spaces with dashes.
const slug = (s) => s.trim().toLocaleLowerCase().replace(/ /g, '-')

// Constants.
// ==========

const topic = argv.t
const topicSlug = slug(topic)
const nickname = slug(argv.n)
logLogo()

// The discovery key is a 32-byte hash based on the topic slug.
const topicDiscoveryKey = crypto.createHash('sha256').update(topicSlug).digest()

// Views.
// ======

// A list of messages, lexographically ordered by timestamp.
const timestampView = list(memdb(), (msg, next) => {
  if (msg.value.timestamp && typeof msg.value.timestamp === 'string') {
    // Ask to sort on the timestamp field.
    next(null, [msg.value.timestamp])
  } else {
    next()
  }
})

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
  pump(socket, core.replicate(details.client, { live: true }), socket)
})

// Kappa Core.
// ===========

// Set up kappa-core.
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
  // log('Chats view is ready.')

  // For any newly-received messages, show them as they arrive.
  // Note: Here, data is returned as an array of objects.
  core.api.chats.tail(1, (data) => {
    const feedNickname = data[0].value.nickname
    nickname !== feedNickname && log(`💬 ${chalk.green(data[0].value.nickname)}: ${data[0].value.text}`, new Date(data[0].value.timestamp))
  })

  core.writer('local', (err, feed) => {
    if (err) throw err

    // log('Local feed is ready.')

    // You can do something with an individual feed here.
    myRL.on('line', function (line) {
      line.length > 0 && feed.append({
        type: 'chat-message',
        nickname: nickname,
        text: line,
        timestamp: new Date().toISOString()
      })
      if (myRL.isMuted()) { myRL.setMuted(false) }

      switch (line) {
        case '/help':
          console.log('Fuck you, no help!')
          break
      }
    })
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

function logLogo () {
  var screen = []
  var termWidth = process.stdout.columns
  var termHeight = process.stdout.rows
  blit(screen, drawFilledBox(termWidth, termHeight), 0, 0)
  blit(screen, [chalk.black(`P2P TribalChat 1.0 topic::${topic}`)], 2, 0)
  console.log(screen.join('\n'))
}

function drawFilledBox (w, h) {
  const backGroundYellow = chalk.bgYellow(' ')

  var top = Array(w).fill(backGroundYellow).join('')

  return [top]
}
