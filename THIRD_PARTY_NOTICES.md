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

## USDA SR28 reference data

US Department of Agriculture, Agricultural Research Service, Nutrient Data Laboratory. **USDA National Nutrient Database for Standard Reference, Release 28**, September 2015 (revised 2016). Federal-government food-composition data is public domain. USDA does not endorse this app or the foods it lists. Reference values are per 100 g edible portion; retain the exact preparation/description. Historical packaged brands/formulations may have changed.

8,789 records are reduced to NDB ID, description, kcal (nutrient 208), protein (203), carbohydrate by difference (205), total lipid (204), and dietary fibre (291). No missing value is filled with zero. The source files, pinned mirror commit and SHA-256 hashes are recorded in `src/data/usda-sr28.meta.json`. The app uses only the government's factual dataset from the mirror, not the mirror's application/scripts. Current official datasets and terms: https://fdc.nal.usda.gov/download-datasets. The catalogue is bundled separately from privately saved food overrides; source provenance survives backups.

The 68 Indian starter items are labelled sample estimates, not USDA records or verified package nutrition. They have no fabricated external source attribution.
