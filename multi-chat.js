process.stdout.write('\x1Bc\n')
var multifeed = require('multifeed')
var argv = require('minimist')(process.argv.slice(2))
var suffix = argv._[0]
const pump = require('pump')
const crypto = require('crypto')
const hyperswarm = require('hyperswarm')
// look for peers listed under this topic
const topic = crypto.createHash('sha256')
  .update('my-hyperswarm-topic')
  .digest()
const multiFeedName = './multichat-' + suffix
var multi = multifeed(multiFeedName, { valueEncoding: 'json' })

const myRL = require('serverline')
// TOOD: https://github.com/SBoudrias/Inquirer.js#layouts

myRL.init()
myRL.setCompletion(['help', 'command1', 'command2', 'login', 'check', 'ping'])

myRL.setPrompt(`@${argv.n}> `)

multi.writer('local', function (err, feed) {
  if (err) throw err
  // TODO: join swarm

  myRL.on('line', function (line) {
    // 'feed' is a hypercore, just like before
    // except now we can manage many of them together!

    line.length > 0 && feed.append({
      type: 'chat-message',
      nickname: argv.n,
      text: line.toString(),
      timestamp: new Date().toISOString()
    }, function (err, seq) {
      if (err) throw err
      // console.log('Data was appended as entry #' + seq)
    })
    // switch (line) {
    //   case 'help':
    //     console.log('help: To get this message.')
    //     break
    //   case 'pwd':
    //     console.log('toggle muted', !myRL.isMuted())
    //     myRL.setMuted(!myRL.isMuted(), '> [hidden]')
    //     return true
    //   case 'secret':
    //     return myRL.secret('secret:', function () {
    //       console.log(';)')
    //     })
    // }

    if (myRL.isMuted()) { myRL.setMuted(false) }
  })
  const swarm = hyperswarm()
  swarm.join(topic, {
    lookup: true, // find & connect to peers
    announce: true
  })

  multi.ready(function () {
    var feeds = multi.feeds()
    // console.log('feeds: ', feeds.length)

    console.log('feeds length', feeds.length)
    // iterate over each feed that exists locally..
    feeds.forEach(function (feed) {
      // feed is a hypercore! (remember reading from hypercores in previous exercises?)
      // TODO: Order logs by time
      feed.createReadStream({ live: true })
        .on('data', function (data) {
          console.log(`<${data.timestamp}> ${data.nickname}: ${data.text}`)
        })
    })

    // listen for new feeds that might be shared with us during runtime..
    multi.on('feed', function (feed) {
      // TODO: feed.createReadStream
      feed.createReadStream({ live: true })
        .on('data', function (data) {
          console.log(`<${data.timestamp}> ${data.nickname}: ${data.text}`)
        })
    })
  })
  swarm.on('connection', function (socket, details) {
    pump(socket, multi.replicate(details.client), socket)
  })
})
