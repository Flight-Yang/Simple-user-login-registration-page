//fs是node.js里读取文件的
const fs = require('fs');
const { type } = require('os');

//读数据库
const usersString = fs.readFileSync('./db/users.json').toString();
//json.pare可以把字符串变成对应的数组或其他的东西
const usersArray = JSON.parse(usersString);
console.log(usersArray);

//写数据库
const user3 = {id:3,name:'tom',password:'yyy'}
//把数组对象写到数组中
usersArray.push(user3);
const string = JSON.stringify(usersArray);
//把字符串写到数据库里
fs.writeFileSync('./db/users.json',string);