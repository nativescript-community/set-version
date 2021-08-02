const path = require("path");
const fs = require("fs");
const pad = (stringToPad, width, paddingCharacter) => {
  const padChar = paddingCharacter || "0";
  const toPad = stringToPad.toString();
  return toPad.length >= width
    ? toPad
    : new Array(width - toPad.length + 1).join(padChar) + toPad;
};

const trimText = s => {
  const indexOfString = s.search(/[^\d]/);
  let result = s;

  if (indexOfString > 0) {
    result = s.substring(0, indexOfString);
  }

  return result;
};

const versionEquals = (versionA, versionB) =>
  versionA.major === versionB.major &&
  versionA.minor === versionB.minor &&
  versionA.patch === versionB.patch;

const versionStringToVersion = (
  versionString,
  currentVersion,
  currentVersionCode
) => {
  const versionParts = versionString.split(".");
  let build = currentVersionCode || 1;
  if (
    versionString && currentVersion &&
    versionEquals(currentVersion, versionStringToVersion(versionString))
  ) {
    const newVersionCode = pad((currentVersionCode + 1).toString(), 2);
    build = +newVersionCode.substr(newVersionCode.length - 2);
    if (build === 0) {
      throw new Error('Sorry you have more than 100 builds using that version consider bumping version or change your version manually');
    }
  }

  return {
    major: +trimText(versionParts[0] || "0"),
    minor: +trimText(versionParts[1] || "1"),
    patch: +trimText(versionParts[2] || "0"),
    build
  };
};

const versionToVersionCode = version => {
  const major = pad(version.major, 2);
  const minor = pad(version.minor, 2);
  const patch = pad(version.patch, 2);
  const { build } = version;

  return +`${major}${minor}${patch}${pad(build, 2)}`;
};



const paths = {
  nsConfig: "./nsconfig.json",
  newNsConfig: "./nativescript.config",
  androidManifest: "Android/AndroidManifest.xml",
  buildGradle: "Android/app.gradle",
  infoPlist: "iOS/Info.plist",
  packageJson: "package.json",
};

function getPaths(config) {
  const PROJECT_ROOT = ".";
  let appPath = path.join(PROJECT_ROOT, "app");
  let appResourcesPath = path.join(PROJECT_ROOT, "app/App_Resources");
  let found = false;
  config = config || paths.newNsConfig;
  if (config) {
      let content;
      if (fs.existsSync(path.join(PROJECT_ROOT, config))) {
          content = fs.readFileSync(path.join(PROJECT_ROOT, config)).toString()
      }
      else if (fs.existsSync(path.join(PROJECT_ROOT, config + '.js'))) {
          content = fs.readFileSync(path.join(PROJECT_ROOT, config+ '.js')).toString()
      }
      else if (fs.existsSync(path.join(PROJECT_ROOT, config + '.ts'))) {
          content = fs.readFileSync(path.join(PROJECT_ROOT, config + '.js')).toString()
      }
  if (content) {
          found = true;
          let match = content.match(/appPath:\s*['"](.*)['"]/)
          if (match[1]) {
              appPath = match[1]
          }
          match = content.match(/appResourcesPath:\s*['"](.*)['"]/)
          if (match[1]) {
              appResourcesPath = match[1]
          }
      }
  } 
  if (!found && fs.existsSync(paths.nsConfig)) {
      const nsConfig = JSON.parse(fs.readFileSync(paths.nsConfig).toString());
      if (nsConfig.appPath) {
          appPath = path.join(PROJECT_ROOT, nsConfig.appPath);
      }
      if (nsConfig.appResourcesPath) {
          appResourcesPath = path.join(
              PROJECT_ROOT,
              nsConfig.appResourcesPath
          );
      }
  }
  return { appPath, appResourcesPath };
}

module.exports = {
  paths,
  getPaths,
  versionStringToVersion,
  versionToVersionCode
};
