// Settings of the landing page.
//
// signUp: the beta sign-up. The page sends it to the sign-up Worker, which checks the captcha
// and passes the answers on to the Google Form.
// - endpoint: the Worker's /signup address, like https://web3-heroes-signup.<account>.workers.dev/signup.
// - turnstileSiteKey: the site key of the Cloudflare Turnstile widget (its secret key goes only into the Worker).
//   Cloudflare's test key 1x00000000000000000000AA always passes, on any host.
// While either is empty, the button says sign-ups open soon.
window.LANDING_CONFIG = {
  signUp: {
    endpoint: "https://web3-heroes-signup.web3heroesgame.workers.dev/signup",
    turnstileSiteKey: "0x4AAAAAAFpRKKuuTStRYGyQ",
  },
};
