// Marks cookie consent as already given so the bar never covers the screen under test.
export function skipConsent(browser, base) {
  const original = browser.newContext.bind(browser)
  browser.newContext = async (...args) => {
    const ctx = await original(...args)
    const value = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))
    await ctx.addCookies([{ name: "organizzou_consent", value, url: base }])
    return ctx
  }
  return browser
}
