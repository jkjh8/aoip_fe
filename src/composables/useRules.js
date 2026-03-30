const ruleExists = (value) => {
  return !!value || 'This field is required'
}

const ruleIp = (value) => {
  if (!value) return true
  if (
    value &&
    /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)){3}$/.test(value)
  ) {
    return true
  }
  return 'Invalid IP address'
}
export { ruleExists, ruleIp }
