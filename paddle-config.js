// Adronis - Paddle connection for the checkout page.
// The client-side token is designed to be public; it can only open checkouts.
// The secret API key lives only in the paddle Edge Function's secrets.
// Going live: switch the environment to "production" and paste the live token
// (live_...) - sandbox and live tokens don't work in each other's environment.
window.LB_PADDLE_ENV = "sandbox";
window.LB_PADDLE_CLIENT_TOKEN = "test_850bbfc37927ede48946fe2e545"; // test_... from Paddle > Developer tools > Authentication
