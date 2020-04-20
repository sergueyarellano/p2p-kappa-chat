const test = require('tape')
const helpers = require('./helpers')

test('formatDate()', function (t) {
  t.plan(2)
  const dateNow = new Date().toLocaleDateString('en-CA')
  const reFormat = /^\d{1,2}\/\d{1,2}\/\d{4}\s\d{1,2}:\d{1,2}:\d{1,2}\s(?:PM|AM)/

  {
    const actual = new RegExp(dateNow).test(helpers.formatDate())
    const expected = true
    t.equal(actual, expected, 'Not passing args returns current date')
  }
  {
    const actual = reFormat.test(helpers.formatDate())
    const expected = true
    t.equal(actual, expected, 'Not passing args returns date formatted')
  }
})

test('slug()', function (t) {
  t.plan(1)
  const actual = helpers.slug(' Hello World ')
  const expected = 'hello-world'
  t.equal(actual, expected, 'Trims string, lower case and replaces spaces with dashes ')
})
