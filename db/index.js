const mysql = require('mysql')
const config = require('./config')
const { debug } = require('../utils/constant')
const {isObject} = require('../utils')

function connect() {
    return mysql.createConnection({
        host: config.host,
        user: config.user,
        password: config.password,
        database: config.database,
        // 允许每条 mysql 语句有多条查询
        multipleStatements: true
    })
}

function querySql(sql) {
    const conn = connect()
    debug && console.log(sql)
    return new Promise((resolve, reject) => {
        try {
            conn.query(sql, (err, results) => {
                if (err) {
                    debug && console.log('查询失败，原因:' + JSON.stringify(err))
                    reject(err)
                } else {
                    debug && console.log('查询成功', JSON.stringify(results))
                    resolve(results)
                }
            })
        } catch (e) {
            reject(e)
        } finally {
            conn.end()
        }
    })
}
// conn 对象使用完毕后需要调用 end 进行关闭，否则会导致内存泄露

function queryOne(sql) {
    return new Promise((resolve, reject) => {
        querySql(sql)
            .then(results => {
                if (results && results.length > 0) {
                    resolve(results[0])
                } else {
                    resolve(null)
                }
            })
            .catch(error => {
                reject(error)
            })
    })
}

function insert(model,tableName) {
    // console.log('model',model);
    return new Promise((resolve,reject) => {
     if (!isObject(model)) {
        reject(new Error('插入数据库失败,插入数据非对象'))
     } else {
        const keys = []
        const values = []
        Object.keys(model).forEach(key => {
            if (model.hasOwnProperty(key)) {
                keys.push(`\`${key}\``)
                values.push(`'${model[key]}'`)
            }
        })
        if(keys.length && values.length) {
            let sql = `INSERT INTO \`${tableName}\`(`
            const keysString = keys.join(',')
            const valuesString = values.join(',')
            sql = `${sql}${keysString}) VALUES (${valuesString})`
            debug && console.log(sql);
            const conn = connect()
            try {
             conn.query(sql,(err,result) => {
                if(err) {
                    reject(err)
                } else {
                    resolve(result)
                }
             })
            } catch(e) {
                reject(e)
            } finally {
                conn.end()
            }
        } else {
            reject(new Error('SQL解析失败'))
        }
     }
     resolve()
    })
   
}

module.exports = {
    querySql,
    queryOne,
    insert
}