const axios = require('axios');
const fs = require('fs');
const simplevdf = require('simple-vdf');
const ABILITY_REGEX = /({s:[^}]*})/g;
const ABILITY_IMAGE_MAPPING = {
  "bloodseeker_blood_rage": "bloodseeker_bloodrage",
  "clockwerk_battery_assault":  "rattletrap_battery_assault",
  "drow_ranger_trueshot_aura": "drow_ranger_trueshot",
  "lone_druid_summon_bear": "lone_druid_spirit_link",
  "lycan_wolf_spawn_shift": "lycan_shapeshift",
  "natures_prophet_summon_tree": "furion_force_of_nature",
  "necrophos_death_pulse": "necrolyte_death_pulse",
  "pudge_meathook": "pudge_meat_hook",
  "shadow_fiend_requiem": "nevermore_requiem",
  "techies_bomb": "techies_remote_mines",
  "terrorblade_metamorph": "terrorblade_metamorphosis",
  "timbersaw_whirling_death": "shredder_whirling_death"
};

const sources = [
  {
    key: "underlords_heroes",
    url: "https://raw.githubusercontent.com/SteamDatabase/GameTracking-Underlords/master/game/dac/pak01_dir/scripts/units.json"
  },
  {
    key: "underlords_abilities",
    url: "https://raw.githubusercontent.com/SteamDatabase/GameTracking-Underlords/master/game/dac/pak01_dir/scripts/abilities.json",
    transform: abilities => {
      Object.entries(abilities).forEach(([key, ability]) => {
        ability.iconName = ABILITY_IMAGE_MAPPING[key] || key;
      });

      return abilities;
    }
  },
  {
    key: "underlords_alliances",
    url: [
      "https://raw.githubusercontent.com/SteamDatabase/GameTracking-Underlords/master/game/dac/pak01_dir/scripts/synergies.json",
      "https://raw.githubusercontent.com/SteamDatabase/GameTracking-Underlords/master/game/dac/pak01_dir/scripts/units.json",
    ],
    transform: resObj => {
      const alliances = resObj[0];
      const heroes = resObj[1];

      Object.entries(alliances).forEach(([key, a]) => {
        a.name = key.toLowerCase();
        let allianceHeroes = [];
        Object.entries(heroes).forEach(([k, hero]) => {
          if (hero.keywords && hero.keywords.includes(a.name)) {
            allianceHeroes.push(hero);
          }
        })

        a.heroes = allianceHeroes.sort((x, y) => {
          if (x.draftTier === y.draftTier) {
            return x.displayName > y.displayName ? 1 : -1;
          }
          return x.draftTier > y.draftTier ? 1: -1;
        })
      });

      return alliances;
    }
  },
  {
    key: "underlords_items",
    url: "https://raw.githubusercontent.com/SteamDatabase/GameTracking-Underlords/master/game/dac/pak01_dir/scripts/items.json"
  },
  {
    key: "underlords_localization_en",
    url: "https://raw.githubusercontent.com/SteamDatabase/GameTracking-Underlords/master/game/dac/panorama/localization/dac_english.txt"
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

async function requestData(url) {
  const response = await axios.get(url, { transformResponse: null });
  let body = response.data;
  return parseJson(body);
}

async function start()
{
  for (let i = 0;i < sources.length; i++)
  {
    const s = sources[i];
    let body = null;
    if (Array.isArray(s.url)) {
      body = await Promise.all(s.url.map(async (url) => requestData(url)))
    } else {
      body = await requestData(s.url);
    }

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