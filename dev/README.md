# Dev tools

```bash
cd dev && npm install                  # ws (for the fake host); Playwright and ImageMagick are expected on the system
node make-manifest.cjs                 # manifest.json (version lives here)
node make-icons.cjs                    # action/category icons, default key, plugin + app icon
node make-gifs.cjs                     # docs/hamster-on.gif, docs/hamster-off.gif
DRYRUN=1 node fake-opendeck.cjs out 16 # plugin under a fake OpenDeck: press, settings, test, auto-off, Stop
node test-pi.cjs pi-shots              # settings panel in Chromium + screenshots
node sheet.cjs out.png a.svg b.svg     # key snapshots side by side
bash package.sh                        # dist/se.wolfpack.idushamsterwheel.sdPlugin.zip
```

Version bump: `make-manifest.cjs` VERSION, the `plugin.js` header + APP_VERSION, the installer header, `pi/wheel.html` eyebrow and CHANGELOG. The manifest Version must equal the release tag minus "v".

Release (from a fresh clone, not the SMB share):

```bash
cd ~ && rm -rf /tmp/hw-build && git clone -q https://github.com/Idus/idus-hamster-wheel /tmp/hw-build && cd /tmp/hw-build && bash dev/package.sh >/dev/null && awk '/^## \[X.Y\]/{f=1;next} /^## \[/{f=0} f' CHANGELOG.md > /tmp/notes-hw.md && gh release create vX.Y --title "Idus Hamster Wheel vX.Y" --notes-file /tmp/notes-hw.md dist/se.wolfpack.idushamsterwheel.sdPlugin.zip install-idus-hamster-wheel.sh idus-hamster-wheel.png
```
