(function () {
  const patches = [];
  let unregisterCommand;

  function parseDateToTimestamp(dateStr) {
    if (!dateStr || typeof dateStr !== "string") return null;
    const trimmed = dateStr.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
    const parsed = Date.parse(trimmed + "T00:00:00.000Z");
    return Number.isNaN(parsed) ? null : parsed;
  }

  return {
    onLoad: function () {
      const { findByProps, findByStoreName } = vendetta.metro;
      const { after } = vendetta.patcher;
      const storage = (vendetta.plugin && vendetta.plugin.storage) || {};
      const { registerCommand } = vendetta.commands;

      if (storage.customDate === undefined) storage.customDate = "2016-01-01";
      if (storage.enabled === undefined) storage.enabled = true;

      const UserStore = findByStoreName("UserStore");
      const SnowflakeUtils = findByProps("extractTimestamp");

      if (SnowflakeUtils && typeof SnowflakeUtils.extractTimestamp === "function") {
        patches.push(
          after("extractTimestamp", SnowflakeUtils, function (args, res) {
            if (!storage.enabled) return res;
            const id = args[0];
            const currentUser = UserStore && UserStore.getCurrentUser ? UserStore.getCurrentUser() : null;
            if (currentUser && id === currentUser.id) {
              const ts = parseDateToTimestamp(storage.customDate);
              if (ts !== null) return ts;
            }
            return res;
          })
        );
      }

      unregisterCommand = registerCommand({
        name: "setdate",
        displayName: "setdate",
        description: "Locally change your displayed Discord account creation date (YYYY-MM-DD)",
        displayDescription: "Locally change your displayed Discord account creation date (YYYY-MM-DD)",
        type: 1,
        inputType: 1,
        options: [
          {
            name: "date",
            displayName: "date",
            description: "Date in YYYY-MM-DD format (e.g. 2016-05-13), or 'off' to reset",
            displayDescription: "Date in YYYY-MM-DD format (e.g. 2016-05-13), or 'off' to reset",
            type: 3,
            required: true,
          },
        ],
        execute: function (args) {
          const firstArg = args && args[0] ? args[0].value : "";
          const foundArg = args ? args.find(function (a) { return a.name === "date"; }) : null;
          const input = String((foundArg && foundArg.value) || firstArg || "").trim();

          if (input.toLowerCase() === "off" || input.toLowerCase() === "reset") {
            storage.enabled = false;
            return {
              content: "Account creation date spoof disabled. Re-open your profile to see your original date.",
            };
          }

          const ts = parseDateToTimestamp(input);
          if (ts === null) {
            return {
              content: "Invalid date format. Use `YYYY-MM-DD` (for example: `2016-05-13`) or `off`.",
            };
          }

          storage.customDate = input;
          storage.enabled = true;
          const unixSeconds = Math.floor(ts / 1000);

          return {
            content: "Local account creation date updated to **" + input + "** (<t:" + unixSeconds + ":D>). Re-open your profile card to refresh it.",
          };
        },
      });
    },

    onUnload: function () {
      for (let i = 0; i < patches.length; i++) {
        try {
          patches[i]();
        } catch (e) {}
      }
      patches.length = 0;
      if (unregisterCommand) unregisterCommand();
    },
  };
})();
