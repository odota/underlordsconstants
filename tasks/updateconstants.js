const axios = require('axios');
const fs = require('fs');
const simplevdf = require('simple-vdf');
const STRING_REPLACE_REGEX = /({(s|d):[^}]*})/g;
const STRING_REPLACE_KEY_REGEX = /({s:)|({d:)|(})/g;
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

const LANGUAGE_MAPPING = {
  "brazilian": "pt-BR",
  "bulgarian": "bg",
  "czech": "cs",
  "danish": "da",
  "dutch": "nl",
  "english": "en",
  "finnish": "fi",
  "german": "de",
  "hungarian": "hu",
  "italian": "it",
  "japanese": "ja",
  "koreana": "ko",
  "latam": "es-419",
  "norwegian": "no",
  "polish": "pl",
  "portuguese": "pt",
  "romanian": "ro",
  "russian": "ru",
  "schinese": "zh-CN",
  "spanish": "es",
  "swedish": "sv",
  "tchinese": "zh-TW",
  "thai": "th",
  "turkish": "tr",
  "ukrainian": "uk",
  "vietnamese": "vn",
};

const sources = [
  {
    key: "underlords_heroes",
    url: "https://raw.githubusercontent.com/SteamDatabase/GameTracking-Underlords/master/game/dac/pak01_dir/scripts/units.json",
    transform: resObj => {
      const heroes = resObj;
      Object.entries(heroes).forEach(([key, hero]) => {
        if (hero.displayName) {
          hero.key = key;
          hero.displayName = hero.displayName.replace('#', '')
        }
      });

      return heroes;
    }
  },
  {
    key: "underlords_abilities",
    url: "https://raw.githubusercontent.com/SteamDatabase/GameTracking-Underlords/master/game/dac/pak01_dir/scripts/abilities.json",
    transform: resObj => {
      const abilities = resObj;

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
      "https://raw.githubusercontent.com/SteamDatabase/GameTracking-Underlords/master/game/dac/pak01_dir/scripts/units.json"
    ],
    transform: resObj => {
      const alliances = normalize(resObj[0]);
      const heroes = resObj[1];
      Object.entries(alliances).forEach(([key, a]) => {
        a.key = key;

        let allianceHeroes = [];
        Object.entries(heroes).forEach(([k, hero]) => {
          hero.key = k;
          if (hero.keywords) {
            hero.keywords.split(" ").forEach((e) => {
              if (a.key === e && hero.draftTier > 0) {
                if (hero.displayName && hero.displayName.includes("#")) {
                  hero.displayName = hero.displayName.replace('#', '')
                }
    
                allianceHeroes.push(hero);
              }
            })
          }
        })

        a.heroes = allianceHeroes.sort((x, y) => {
          return x.draftTier > y.draftTier ? 1: -1;
        })
      });

      return alliances;
    }
  },
  {
    key: "underlords_items",
    url: "https://raw.githubusercontent.com/SteamDatabase/GameTracking-Underlords/master/game/dac/pak01_dir/scripts/items.json",
    transform: items => {
      Object.entries(items).forEach(([key, item]) => {
        item.displayName = item.displayName.replace('#', '');
        item.description = item.description.replace('#', '');
        item.type = item.type.replace('equipment_', '');
        item.key = key;
      });

      return items;
    }
  }
];

function replacePlaceholders(str, values) {
  const matches = str.match(STRING_REPLACE_REGEX);
  if (matches) {
    matches.forEach((s) => {
        let replace = '';
        const key = s.replace(STRING_REPLACE_KEY_REGEX, '');
        if (key in values) {
            const val = values[key];
            replace = Array.isArray(val) ? `[${val.join('/')}]` : val;
        }

        str = str.replace(s, replace);
    })
  }

  return str;
}

function transformAbilities (resObj) {
  const strings = normalize(resObj[0].tokens)
  const abilities = resObj[1];

  Object.entries(abilities).forEach(([key, ability]) => {
    stringKey = `dac_ability_${key}_description`;
    let desc = strings[stringKey];
    if (desc) {
      desc = replacePlaceholders(desc, ability);
      strings[stringKey] = desc.replace(/<br>/g, '\n');
    }
  });

  return strings;
}

function transformLocalization (resObj) {
  const strings = resObj[0];
  const synergies = resObj[1];
  const items = resObj[2];

  Object.entries(synergies).forEach(([key, synergy]) => {
    synergy.levels.forEach((l, i) => {
      stringKey = `dac_synergy_desc_${key.toLocaleLowerCase()}_${i+1}`;
      let desc = strings[stringKey];
      if (desc) {
        const matches = desc.match(STRING_REPLACE_REGEX);
        if (matches) {
          matches.forEach((s) => {
              let replace = '';
              const key = s.replace(STRING_REPLACE_KEY_REGEX, '');
              if (key in synergy) {
                  const val = synergy[key];
                  replace = Array.isArray(val) ? val[i] : val;
              }
      
              desc = desc.replace(s, replace);
          })
        }
        strings[stringKey] = desc.replace(/<br>/g, '\n');
      }
    })
  });

  Object.entries(items).forEach(([key, item]) => {
    stringKey = "description" in item ? item.description.replace("#", '') : `dac_item_${key}_desc`;
    let desc = strings[stringKey];
    if (desc) {
      const matches = desc.match(STRING_REPLACE_REGEX);
      if (matches) {
        matches.forEach((s) => {
            let replace = '';
            const replaceKey = s.replace(STRING_REPLACE_KEY_REGEX, '');
            if (replaceKey in item) {
                const val = item[replaceKey];
                replace = Array.isArray(val) ? `[${val.join('/')}]` : val;
            } else if ("global" in item && key in item["global"]) {
              const val = item["global"][key][replaceKey];
              replace = Array.isArray(val) ? `[${val.join('/')}]` : val;
            }

            desc = desc.replace(s, replace);
        })
      }
      strings[stringKey] = desc.replace(/<br>/g, '\n');
    } else {
      console.log("did not find description for ", key, stringKey);
    }
  })

  return strings;
}

function parseJson(text) {
  // Remove trailing commas from JSON
  let regex = /\,(?=\s*?[\}\]])/g;

  try {
    text = text.replace(regex, "");
    return JSON.parse(text);
  }
  catch (err) {
    let vdf = simplevdf.parse(text);
    vdf = vdf[Object.keys(vdf)[0]];
    return normalize(vdf);
  }
}

function normalize(json) {
  let keys = Object.keys(json);
  let normalized = {};
  for (let key of keys) {
    normalized[key.toLowerCase()] = json[key];
  }
  return normalized;
}

async function requestData(url) {
  const response = await axios.get(url, { transformResponse: null });
  let body = response.data;
  return parseJson(body);
}

async function processSource(s) {
    let body = null;
    if (Array.isArray(s.url)) {
      body = await Promise.all(s.url.map(async (url) => requestData(url)))
    } else {
      body = await requestData(s.url);
    }

    if (s.transform) {
      body = s.transform(body);
    }

    return body;
}

async function start()
{
  Object.entries(LANGUAGE_MAPPING).forEach(([key, val]) => {
    sources.push({
      key: `underlords_localization_${val}`,
      url: [
        `https://raw.githubusercontent.com/SteamDatabase/GameTracking-Underlords/master/game/dac/panorama/localization/dac_${key}.txt`,
        'https://raw.githubusercontent.com/SteamDatabase/GameTracking-Underlords/master/game/dac/pak01_dir/scripts/synergies.json',
        'https://raw.githubusercontent.com/SteamDatabase/GameTracking-Underlords/master/game/dac/pak01_dir/scripts/items.json'
      ],
      transform: transformLocalization
    });
    sources.push({
      key: `underlords_localization_abilities_${val}`,
      url: [
        `https://raw.githubusercontent.com/SteamDatabase/GameTracking-Underlords/master/game/dac/pak01_dir/resource/localization/dac_abilities_${key}.txt`,
        "https://raw.githubusercontent.com/SteamDatabase/GameTracking-Underlords/master/game/dac/pak01_dir/scripts/abilities.json"
      ],
      transform: transformAbilities
    });
  })

  for (let i = 0; i < sources.length; i++)
  {
    const s = sources[i];
    console.log(s);
    fs.writeFileSync('./build/' + s.key + '.json', JSON.stringify(await processSource(s), null, 2));
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