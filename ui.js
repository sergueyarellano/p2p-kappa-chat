const chalk = require('chalk')
const blit = require('txt-blit')
var diffy = require('diffy')({ fullscreen: true })
var trim = require('diffy/trim')
var input = require('diffy/input')({ style: style })
var chatLines = []

input.on('update', () => diffy.render())
// input.on('enter', (line) => names.push(line))

diffy.render(function () {
  process.stdout.write('')
  return trim(update())
})
process.stdout.on('resize', function () {
  process.stdout.write('')
  setTimeout(() => {
    process.stdout.write('')
    diffy.render()
  }, 1000)
})

function style (start, cursor, end) {
  return start + '[' + (cursor || ' ') + ']' + end
}

function update () {
  var screen = []
  var termWidth = process.stdout.columns
  var termHeight = process.stdout.rows
  const userInput = input.line()
  blit(screen, drawFilledBox(termWidth, termHeight), 0, 0)
  blit(screen, [chalk.black('TribalScale P2P chat 1.0')], 2, 0)
  const numberOfLinesToShow = termHeight - 3
  const newArr = chatLines.slice(-numberOfLinesToShow)
  newArr.forEach((line, index) => {
    blit(screen, [chalk.white(line)], 2, 1 + index)
  })
  blit(screen, ['> ' + chalk.black.bold(userInput)], 5, termHeight - 1)

  return screen.join('\n')
}

function drawFilledBox (w, h) {
  const backGroundYellow = chalk.bgYellow(' ')
  const backGroundWhite = chalk.bgWhite(' ')

  var topDown = Array(w).fill(backGroundYellow).join('')

  var middleSingle = [backGroundWhite].concat(Array(w - 2).fill(' ')).concat(backGroundWhite).join('')
  var middleMultiple = Array(h - 2).fill(middleSingle)

  var result = [topDown].concat(middleMultiple).concat(topDown)
  return result
}

module.exports = {
  onEnter: (fn) => input.on('enter', fn),
  update: (data) => {
    chatLines.push(`<${data.timestamp}> ${data.nickname}: ${data.text}`)
    diffy.render()
  }
}
