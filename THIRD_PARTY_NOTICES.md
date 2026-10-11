# Dependency and data notices

Exact direct versions and integrity hashes are in package-lock.json. These components are free/open source; consult their bundled licence files for full notices and transitive dependencies.

| Component                                                                 | Licence                                                | Purpose                                        |
| ------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| React / React DOM                                                         | MIT                                                    | Interface                                      |
| TypeScript                                                                | Apache-2.0                                             | Type checking                                  |
| Vite / React plugin                                                       | MIT                                                    | Build                                          |
| Supabase JS                                                               | MIT                                                    | Auth/database/Edge client                      |
| zxing-wasm                                                                | MIT                                                    | Local WASM barcode wrapper                     |
| ZXing-C++ (bundled by zxing-wasm)                                         | Apache-2.0                                             | Barcode decoder                                |
| idb                                                                       | ISC                                                    | IndexedDB                                      |
| Lucide React                                                              | ISC                                                    | Icons                                          |
| vite-plugin-pwa                                                           | MIT                                                    | PWA build                                      |
| Workbox                                                                   | MIT                                                    | Service worker                                 |
| DM Sans / Manrope                                                         | SIL Open Font License 1.1                              | Self-hosted fonts through Fontsource           |
| Fontsource packaging                                                      | MIT                                                    | Font distribution                              |
| Vitest / Testing Library / jsdom / fake-indexeddb / Playwright / Prettier | MIT                                                    | Development/testing                            |
| PGlite                                                                    | Apache-2.0, PostgreSQL engine under PostgreSQL licence | Embedded real PostgreSQL testing               |
| bwip-js / BWIPP                                                           | MIT                                                    | Synthetic test barcode images                  |
| Deno                                                                      | MIT                                                    | Edge Function type checking during development |

## Open Food Facts

Source: https://world.openfoodfacts.org, official API documentation: https://github.com/openfoodfacts/openfoodfacts-server/tree/main/docs/api.

The database is licensed under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1.0/); individual contents under the [Database Contents License 1.0](https://opendatacommons.org/licenses/dbcl/1.0/). Product images would be CC BY-SA, but this app does not download/display those images. Imports retain barcode/source IDs, product URL and the requested raw source subset. Nutrition corrections live separately in the private food row; the original source data is not overwritten. Every imported food displays an OFF source link/attribution. Exports retain provenance. User-entered/private recipe nutrition is not presented as OFF data and isn't uploaded to OFF.

Data is community supplied, may be incomplete or wrong, and needs confirmation against the package. Review ODbL attribution/share-alike obligations before public redistribution of imported databases or exports. No app uploads, paid food API, or AI nutrition service exists.
