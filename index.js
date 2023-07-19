import {readFile, readdir, writeFile, open, rm, mkdir} from 'fs/promises';
import parseJson from 'parse-json';
import {createWriteStream} from "fs";
import https from 'https'

const nodeModulesDir = './dist'

// urlの一覧を取得
const resolvedUrls = await createResolvedUrls();

console.log(`detect ${resolvedUrls.length} packages.`)

// ダウンロード先のリセット
await rm(nodeModulesDir, {force: true, recursive: true})
await mkdir(nodeModulesDir)

const downloadPackagesCount = await downloadPackages()


function parseUrl(urlString) {
    const url = new URL(urlString)
    const urlPath = url.pathname
    const [packagePath, fileName] = urlPath.split('/-/')
    return {packagePath, fileName}
}



// package-lock.jsonを読み込み、,resolved urlの一覧を生成する。
// package-lock.jsonは、<./jsons>ディレクトリにまとめること
async function createResolvedUrls() {
    const jsonDirPath = './jsons'
    // package-lock.jsonのファイル名を取得
    const fileNames = await readdir(jsonDirPath)

    const resolvedList = []
    // ファイルごとにresolvedのURLを抽出
    for (let name of fileNames) {
        const path = `${jsonDirPath}/${name}`
        const file = await readFile(path, "utf8")
        const json = parseJson(file)
        resolvedList.push(...listUpResolved(json))
    }
    // 重複を削除
    const uniqueList = Array.from(new Set(resolvedList))
    return uniqueList
}

// JSONを解析して、resolvedのURLをリストアップする
// dependenciesがネストしているので、再起的に処理する。
function listUpResolved(json) {
    const resolvedList = [];
    Object.entries(json).forEach(([key, value]) => {
        if (key === 'resolved') {
            resolvedList.push(json.resolved)
        }
        if (typeof value === 'object') {
            const innerResolvedList = listUpResolved(value)
            resolvedList.push(...innerResolvedList)
        }
    })
    return resolvedList
}

async function downloadPackages() {
    let counter = 0;

// ダウンロード
// エラー処理等していないのでエラー出たらごめん
    for await (let url of resolvedUrls) {
        https.get(url, async res => {
            const {packagePath, fileName} = parseUrl(url);
            const distPackagePath = `${nodeModulesDir}${packagePath}`
            await mkdir(distPackagePath, {recursive: true}).catch((e) => {
                if(e.code === 'EEXIST') {
                    console.log(`skip make exist already exists dir ${distPackagePath}`)
                } else {
                    throw e
                }
            })

            const ws = createWriteStream(`${distPackagePath}/${fileName}`)
            res.pipe(ws)
        })
    }
    // http.get等の仕様理解不足でカウンタが先に帰る
    return counter;
}
