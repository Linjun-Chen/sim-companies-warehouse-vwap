# Sim Companies Warehouse VWAP

[Download the latest release](https://github.com/Linjun-Chen/sim-companies-warehouse-vwap/releases/latest) · [简体中文](README.md) · [15 languages](docs/README.md)

This Chrome extension reads official volume-weighted average prices (VWAP) for the products and qualities you have in stock. Quotes and discounted prices appear in the warehouse overview and on each product page.

## Install and update

1. Download `warehouse-vwap-v*.zip` under **Assets** and extract it. [Latest release](https://github.com/Linjun-Chen/sim-companies-warehouse-vwap/releases/latest)
2. Open `chrome://extensions`, enable **Developer mode**, and select **Load unpacked**. Choose the `warehouse-vwap` folder containing `manifest.json`. [Chrome installation guide](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked)
3. Sign in to Sim Companies and open your warehouse. Expand **Warehouse VWAP** for an overview, or open a product to see quotes by quality. Official charts by quality require in-game Supporter access.

To update, extract the new files over the original folder. Click **Reload** on the existing extension card, check the version, then refresh the warehouse tab. Using the same folder keeps your local settings and cached quotes.

## Quote settings

- On a product page, click the percentage next to the discounted price to edit the product default and the discounts for Q0 through Q12. Leave a field blank to inherit, or enter 0 for no discount. Saving recalculates prices immediately using locally stored quotes. If the discounted price is hidden, enable it under **Display and data**.
- Set the default discount and number of days in the toolbar popup. The preview shows the exact UTC dates.
- Open **All settings** to change the interface language, display options, or per-product rules. Search by English name, Chinese name, or product ID. The overview uses Chinese product names in Simplified Chinese and English product names in the other languages. A blank field inherits the product or global setting. Quality overrides apply to Q0 through Q12.
- The popup, settings, and warehouse quotes follow Chrome’s display language by default. Use the **Language** selector at the top of **All settings** to switch. **Display and data** controls the auto-fetch scope, visible fields, decimal places, number formatting, layout, and theme.

## How the VWAP period works

The period can span 1 to 365 calendar days and ends at yesterday’s UTC close. One day uses yesterday. Two days include yesterday and the day before.

Period VWAP = Σ (daily VWAP × daily volume) ÷ Σ (daily volume). If 100 units trade at a daily VWAP of $8.000 and 300 at $10.000, the combined VWAP is $9.500. A 5% discount gives $9.025 before display rounding. Days without trades carry zero weight. If there are no trades in the period, the row shows a message.

## Data and refresh

Opening the in-game daily chart can fill the quote cache. With auto-fetch enabled, the extension uses the game’s existing inventory list to queue missing quotes for stocked products and qualities in the current realm. You can also limit auto-fetch to the open product. All tabs share one cache and a minimum five-minute interval between extension requests.

Quotes refresh at midnight UTC on open warehouse pages. The previous quote keeps its actual date until new data arrives. Reopening a warehouse page uses its local cache and checks for missing data.

## Development

After cloning, you can load the repository root directly in Chrome. Run `npm ci` and `npm test` with Node.js 24 to test the extension. [GitHub Actions test results](https://github.com/Linjun-Chen/sim-companies-warehouse-vwap/actions/workflows/test.yml)

Report a problem through the bug report form. [Issues](https://github.com/Linjun-Chen/sim-companies-warehouse-vwap/issues/new/choose)

The project uses the [MIT License](LICENSE).
