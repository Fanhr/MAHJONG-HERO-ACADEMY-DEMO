const fs = require('fs');
const { Resvg } = require('@resvg/resvg-js');
const svg = fs.readFileSync('/Users/hurryfan/CodeBuddy/原型：英雄麻将/数值/番种伤害一览.svg', 'utf-8');
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1600 },
  font: { loadSystemFonts: true, defaultFontFamily: 'PingFang SC' },
});
const png = resvg.render();
fs.writeFileSync('/Users/hurryfan/CodeBuddy/原型：英雄麻将/数值/番种伤害一览.png', png.asPng());
console.log('PNG written');
