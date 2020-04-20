module.exports = {
  formatDate,
  log,
  slug,
  getIPV4FromIPV6
}
function formatDate (date = new Date()) {
  // Returns a formatted time stamp from the passed date (or the current date)
  return `${date.toLocaleDateString('en-CA')} ${date.toLocaleTimeString('en-CA')}`
}

function log (msg, date = new Date()) {
  console.log(`${formatDate(date)}: ${msg}`)
}

function slug (s) {
  // “Sluggifies” the passed string: removes spaces and replaces inter-word spaces with dashes.
  return s.trim().toLocaleLowerCase().replace(/\s/g, '-')
}

function getIPV4FromIPV6 (ipv6) {
  return ipv6.match(/.*:(.*)/)[1]
}
