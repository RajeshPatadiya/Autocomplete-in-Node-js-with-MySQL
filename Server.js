import express from 'express';
const app = express();
import mysql from 'mysql';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import ejs from 'ejs';
import { metaphone } from 'metaphone';
import { stemmer } from 'stemmer';
import querystring from "querystring";

var connection = mysql.createConnection({
	host: 'staging-instance-1.c8veqfm0xdx2.ap-south-1.rds.amazonaws.com',
	user: 'root',
	password: 'VbIkyGC5kGY9Vn4NOrqAcQ0hacu4gBXHocOx81er',
	database: 'db_cellula_staging'
});

connection.connect();


app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/JS'));
app.set('view engine', 'ejs');
//cors
app.use(function (req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	next();
});
app.engine('html', ejs.renderFile);

app.get('/', function (req, res) {
	res.render('index.html');
});

app.get('/search', async function (req, res) {
	if (req.query.key) {
		// req.query.key = await metaphone(req.query.key);
		let words = await req.query.key.split(' ');
		let stem = [];
		let metaphoneWords = [];
		await words.forEach((word, i) => {
			console.log(words.length);
			switch (words.length) {
				case 1:
					stem.push(stemmer(word) + "\*");
					break;
				case 2:
					if (i == 0) {
						stem.push("\+" + (word));
					} else if (i == (words.length - 1)) {
						stem.push("\+" + stemmer(word) + "\*");
					}
					break;
				case 3:
					if (i == 0) {
						stem.push("\+" + stemmer(word) + "*");
					} else if (i == 1) {
						stem.push("\+" + stemmer(word) + "\*");
					} else if (i == (words.length - 1)) {
						// ‘+mysql +(>tutorial <training)’
						stem.push("\+(>" + stemmer(word) + "\*" + "\)");
					}
					break;
				case 4:
					if (i == 0) {
						stem.push("\+" + stemmer(word));
					} else if (i == 1) {
						stem.push("\+(>" + stemmer(word));
					} else if (i == 2) {
						stem.push("\+" + stemmer(word));
					} else if (i == (words.length - 1)) {
						stem.push("\+" + stemmer(word) + "\*" + "\)");
					}
					break;
				default:
					if (words.length > 4) {
						stem.push("\"" + stemmer(word) + "\"");
					} else {
						stem.push("\+" + stemmer(word))
					}
					console.log("default case");
					break;
			}

			metaphoneWords.push(metaphone(word));
		});
		let stem_string = stem.join(' ');
		req.query.key = stem_string;
		console.log(req.query.key);
		let limit = 100;
		let orderBy = "length";
		let query = 'SELECT DISTINCT(p.name), LENGTH (p.name) as length,match(p.name) against("' + req.query.key + '") as score, sc.name as category, c.name as module from products as p LEFT JOIN categories as c ON p.category_id = c.id LEFT JOIN sub_categories as sc ON p.subcategory_id = sc.id where ';
		if (!req.query.key) {
			orderBy += " DESC";
			query += 'lower(p.name) like "%';
			query += (req.query.key).toLowerCase();
			query += '%"';
		} else {
			orderBy += " ASC";
			query += 'MATCH (p.name) AGAINST (';
			query += '"' + req.query.key + '"';
			query += ' IN BOOLEAN MODE)';
			// query += ' IN NATURAL LANGUAGE MODE)';
		}
		if (req.query.module) {
			let category_id = 2;
			switch (req.query.module) {
				case 'shopping':
					category_id = 2;
					break;
				case 'grocery':
					category_id = 7;
					break;
			}
			query += ' and p.category_id = ' + category_id;
		}
		if (req.query.limit) {
			limit = req.query.limit;
		}
		if (req.query.key) {
			query += ' ORDER BY score ASC, ' + orderBy;
		}
		query += ' LIMIT ' + limit;
		connection.query(query, async function (err, rows, fields) {
			if (err) throw err;
			var data = [];
			if (rows.length) {
				for (let i = 0; i < rows.length; i++) {
					// console.log(rows[i]);
					let words = rows[i].name.split(' ');
					let stem = [];
					let metaphoneWords = [];
					for (let j = 0; j < words.length; j++) {
						stem.push(stemmer(words[j]));
						metaphoneWords.push(metaphone(stemmer(words[j])));
					}
					let stem_string = stem.join(' ');
					let metaphone_string = metaphoneWords.join(' ');
					data.push({
						name: rows[i].name,
						category: rows[i].category,
						module: rows[i].module,
						score: rows[i].score,
						stem: stem_string,
						rowSearch: metaphone_string,
					});
				}
			}

			let search_data = data;
			res.end(JSON.stringify(search_data));
		});
	} else {
		res.end(JSON.stringify([]));
	}
});

var server = app.listen(3000, function () {
	console.log("We have started our server on port 3000");
});
