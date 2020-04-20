const sl = require('serverline')
const chalk = require('chalk')
const blit = require('txt-blit')
const argv = require('minimist')(process.argv.slice(2))
const store = require('./store')

module.exports = init

function init () {
  // logLogo()
  sl.init()
  sl.setCompletion(['help', 'command1', 'command2', 'login', 'check', 'ping'])
  sl.setPrompt(chalk.magenta(`@${argv.n}> `))

  return {
    appendOnEnter: appendOnEnter(sl)
  }
}

function appendOnEnter (sl) {
  return (feed) => {
    sl.on('line', function (line) {
      // If it is not a command, append the line to local hypercore
      /^[^/]/.test(line) && line.length > 0 && feed.append({
        type: 'chat-message',
        nickname: argv.n,
        text: line,
        timestamp: new Date().toISOString()
      })

      // if (sl.isMuted()) { sl.setMuted(false) }

      switch (line) {
        case '/help':
          console.log('Fuck you, no help!')
          break
        case '/connected': {
          const users = store.get('users')
          users.forEach(user => console.log(`${user.nickname}@${user.host}:${user.port} ${user.local ? 'LAN' : 'WAN'}`))
          break
        }
      }
    })
  }
}

function logLogo () {
  process.stdout.write('\x1Bc\n')
  var screen = []
  var termWidth = process.stdout.columns
  var termHeight = process.stdout.rows
  blit(screen, drawFilledBox(termWidth, termHeight), 0, 0)
  blit(screen, [chalk.black(`P2P TribalChat 1.0 topic::${argv.t}`)], 2, 0)
  console.log(screen.join('\n'))
  process.stdout.write('\x1Bc\n')
}

function drawFilledBox (w, h) {
  const backGroundYellow = chalk.bgYellow(' ')
  var top = Array(w).fill(backGroundYellow)
  return top
}
