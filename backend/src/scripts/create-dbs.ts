// Creates the app and test databases if missing. Used locally where psql is not installed.
import pg from 'pg';

const urls = [process.env.DATABASE_URL, process.env.DATABASE_URL_TEST].filter(Boolean) as string[];

for (const url of urls) {
  const target = new URL(url);
  const name = target.pathname.slice(1);
  target.pathname = '/postgres';
  const client = new pg.Client({ connectionString: target.toString() });
  await client.connect();
  const { rowCount } = await client.query('select 1 from pg_database where datname = $1', [name]);
  if (rowCount) {
    console.log(`Database ${name} already exists`);
  } else {
    await client.query(`create database ${pg.escapeIdentifier(name)}`);
    console.log(`Created database ${name}`);
  }
  await client.end();
}
