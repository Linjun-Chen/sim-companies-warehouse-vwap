# Sim Companies Warehouse VWAP

[简体中文](README.md)

This Chrome extension shows the official volume-weighted average price (VWAP) and a discounted price next to each quality in your Sim Companies warehouse.

## Install and update

1. Download and unzip `warehouse-vwap-v*.zip` from [Releases](https://github.com/Linjun-Chen/sim-companies-warehouse-vwap/releases/latest).
2. Open `chrome://extensions`, enable Developer mode, and select **Load unpacked**. Choose the `warehouse-vwap` folder containing `manifest.json`. You can also load the repository root after cloning.
3. For updates, extract the new files over the original folder, click **Reload** on the extension’s card, and refresh the game tab. Your settings and cached daily candles are stored locally.

## Quote settings

- Set the default discount and number of days in the toolbar popup. One day uses yesterday’s completed UTC candle. Two days include yesterday and the day before, weighted by trading volume. The preview shows the exact UTC dates.
- Open **All settings** to change the interface language, display options, or per-product rules. Search by English name, Chinese name, or product ID. A blank field inherits the product or global setting. Quality overrides apply to Q0 through Q12.
- The popup, settings, and warehouse quotes support English and Simplified Chinese. The default follows Chrome’s display language, with English for unsupported locales.

## Data and refresh

The extension uses official daily charts by quality, which require Supporter access. Opening the in-game daily chart can fill the cache. With auto-fetch enabled, the extension queries missing quotes for the warehouse product you have open and spaces its own requests at least five minutes apart.

Quotes refresh at midnight UTC on open warehouse pages. The previous quote keeps its actual date until new data arrives. Reopening a warehouse page uses its local cache and checks for missing data.

## Development

Run `npm ci` and `npm test` with Node.js 24. An unpacked installation needs no Node.js dependencies. Report problems through [Issues](https://github.com/Linjun-Chen/sim-companies-warehouse-vwap/issues/new/choose). The project uses the [MIT License](LICENSE).
