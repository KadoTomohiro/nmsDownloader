import {readFile, readdir, writeFile, open, rm, mkdir} from 'fs/promises';
import parseJson from 'parse-json';
import {createWriteStream} from "fs";
import https from 'https'

const nodeModulesDir = './dest'

// urlの一覧を取得
const resolvedUrls = await createResolvedUrls();

// ダウンロード先のリセット
await rm(nodeModulesDir, {force: true, recursive: true})
await mkdir(nodeModulesDir)

// ダウンロード
// エラー処理等していないのでエラー出たらごめん
for (let url of resolvedUrls) {
    https.get(url, async res => {
        const filename = url.split('/').at(-1);
        const ws = createWriteStream(`${nodeModulesDir}/${filename}`)
        res.pipe(ws)
    })
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
    if(json.resolved) {
        resolvedList.push(json.resolved)
    }
    if(json.dependencies) {
        Object.values(json.dependencies).forEach(moduleJson => {
            const dependencyResolvedList = listUpResolved(moduleJson)
            resolvedList.push(...dependencyResolvedList)
        })
    }
    return resolvedList
}
