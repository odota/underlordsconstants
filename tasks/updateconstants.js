const axios = require('axios');
const fs = require('fs');
const simplevdf = require('simple-vdf');

const sources = [
  {
    key: "underlords_heroes",
    url: "https://raw.githubusercontent.com/SteamDatabase/GameTracking-Underlords/master/game/dac/pak01_dir/scripts/units.json",
    transform: resObj => resObj
  },
  {
    key: "underlords_abilities",
    url: "https://raw.githubusercontent.com/SteamDatabase/GameTracking-Underlords/master/game/dac/pak01_dir/scripts/abilities.json",
    transform: resObj => resObj
  },
  {
    key: "underlords_alliances",
    url: "https://raw.githubusercontent.com/SteamDatabase/GameTracking-Underlords/master/game/dac/pak01_dir/scripts/synergies.json",
    transform: resObj => resObj
  },
  {
    key: "underlords_items",
    url: "https://raw.githubusercontent.com/SteamDatabase/GameTracking-Underlords/master/game/dac/pak01_dir/scripts/items.json",
    transform: resObj => resObj
  },
  {
    key: "underlords_localization_en",
    url: "https://raw.githubusercontent.com/SteamDatabase/GameTracking-Underlords/master/game/dac/panorama/localization/dac_english.txt",
    transform: resObj => resObj
  },
  {
    key: "underlords_localization_abilities_en",
    url: "https://raw.githubusercontent.com/SteamDatabase/GameTracking-Underlords/master/game/dac/pak01_dir/resource/localization/dac_abilities_english.txt",
    transform: resObj => resObj.tokens
  }
];

function parseJson(text) {
  try {
    return JSON.parse(text);
  }
  catch (err) {
    let vdf = simplevdf.parse(text);
    vdf = vdf[Object.keys(vdf)[0]];
    let keys = Object.keys(vdf);
    let normalized = {};
    for (let key of keys) {
      normalized[key.toLowerCase()] = vdf[key];
    }
    return normalized;
  }
}

async function start()
{
  for (let i = 0;i < sources.length; i++)
  {
    const s = sources[i];
    const url = s.url;
    //grab raw data from each url and save
    console.log(url);
    const response = await axios.get(url, { transformResponse: null });
    let body = response.data;
    body = parseJson(body)
    if (s.transform) {
      body = s.transform(body);
    }
    fs.writeFileSync('./build/' + s.key + '.json', JSON.stringify(body, null, 2));
  }

  // Reference built files in index.js
  const cfs = fs.readdirSync('./build');
  // Exports aren't supported in Node yet, so use old export syntax for now
  // const code = cfs.map((filename) => `export const ${filename.split('.')[0]} = require(__dirname + '/json/${filename.split('.')[0]}.json');`).join('\n';
  const code = `module.exports = {
${cfs.map((filename) => `${filename.split('.')[0]}: require(__dirname + '/build/${filename.split('.')[0]}.json')`).join(',\n')}
};`;
  fs.writeFileSync('./index.js', code);
  process.exit(0);
}

start();