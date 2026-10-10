# B1 font sources

Clash Display 500/600 and General Sans 400/500/600: Fontshare official API, separate family requests; terms: https://www.fontshare.com/licenses/itf-ffl .

JetBrains Mono 400/500/700: Google Fonts official text-subset API; CDN URL first, identical local fallback second.

Noto Sans SC: Google Fonts official text-subset CDN first, identical self-hosted fallback second. Disjoint unicode ranges are grouped by observed page usage so requests include only relevant glyphs. font-display swap throughout. OFL files included.

Chinese coverage: common 3500 table plus current frontend/design copy. Table source: https://raw.githubusercontent.com/NightFurySL2001/cjktables/master/china/standard/xiandai_changyong.txt.

See manifest.json for exact source URLs, coverage, bytes and SHA256. The preparation script is in the B1 acceptance package, not in the runtime bundle.
