#!/usr/bin/env node

const fs = require("fs");
const g2js = require("gradle-to-js/lib/parser");
const path = require("path");
const plist = require("plist");
const { getConfig, paths } = require("./versionUtils");
const { exec } = require("child_process");
function execute(command){
    return new Promise((resolve,reject)=>{
        exec(command, function(error, stdout, stderr){ if (error) {reject(stderr)} else {resolve(stdout);} });
    })
};

const getVersion = async () => {
    const platform = process.argv[2];
    const type = process.argv[3];
    const config = process.argv[4];
    const actualConfig = await getConfig(config);
    const { appResourcesPath } = actualConfig;

    if (platform === "ios") {
        const plistInfo = plist.parse(
            fs.readFileSync(
                path.join(appResourcesPath, paths.infoPlist),
                "utf8"
            )
        );
        switch (type) {
            case "code":
                console.log(plistInfo.CFBundleVersion);
                break;
            case "version":
                console.log(plistInfo.CFBundleShortVersionString);
                break;
            case "version":
                console.log(
                    `${plistInfo.CFBundleShortVersionString}.${listInfo.CFBundleVersion}`
                );
                break;
        }
    } else if (platform === "android") {
        const gradle = await g2js.parseFile(
            path.join(appResourcesPath, paths.buildGradle)
        );
        const currentVersion = gradle.android.defaultConfig.versionName;
        const currentVersionCode = +gradle.android.defaultConfig.versionCode;
        switch (type) {
            case "code":
                console.log(currentVersionCode);
                break;
            case "version":
                console.log(currentVersion);
                break;
            case "version":
                console.log(`${currentVersion}.${currentVersionCode}`);

                break;
        }
    }
};

getVersion();
