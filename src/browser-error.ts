throw new Error(
  "The halosis SDK only supports server-side Node.js. Direct browser usage exposes API " +
    "credentials and cannot reliably satisfy Halosis IP-whitelist requirements. Call Halosis " +
    "from a backend with a whitelisted outbound IP address instead.",
);

export {};
