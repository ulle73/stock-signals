import { getDatabaseUrl } from '../db.js';

const DO_BLOCK_REGEX = /do \$\$[\s\S]*?\$\$;/gi;

function getAlterTableStatementFromDoBlock(block) {
  const match = block.match(/then\s*(alter table[\s\S]*?;)\s*end if;/i);
  return match?.[1]?.trim() ?? null;
}

function buildRerunnableConstraintSql(statement) {
  const tableMatch = statement.match(/alter table\s+([^\s]+)/i);
  const constraintMatch = statement.match(/add constraint\s+([^\s]+)/i);

  if (!tableMatch || !constraintMatch) {
    return statement;
  }

  const tableName = tableMatch[1];
  const constraintName = constraintMatch[1];
  const normalizedStatement = statement.replace(/;\s*$/, '');

  return `alter table ${tableName}
  drop constraint if exists ${constraintName};

${normalizedStatement};`;
}

function transformDoBlockForCockroach(block) {
  const statement = getAlterTableStatementFromDoBlock(block);

  if (!statement) {
    return '';
  }

  const normalized = statement.toLowerCase();

  if (normalized.includes(' rename column ') || normalized.includes(' rename constraint ')) {
    return '';
  }

  if (normalized.includes(' add constraint ')) {
    return buildRerunnableConstraintSql(statement);
  }

  return statement;
}

export function transformMigrationSqlForCockroach(sql) {
  return sql
    .replace(DO_BLOCK_REGEX, (block) => transformDoBlockForCockroach(block))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inSingleQuote = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    current += char;

    if (char === "'" && inSingleQuote && next === "'") {
      current += next;
      index += 1;
      continue;
    }

    if (char === "'") {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === ';' && !inSingleQuote) {
      const statement = current.slice(0, -1).trim();
      if (statement) {
        statements.push(statement);
      }
      current = '';
    }
  }

  const trailing = current.trim();
  if (trailing) {
    statements.push(trailing);
  }

  return statements;
}

export function shouldUseCockroachMigrationCompatibility(env = process.env) {
  const databaseUrl = getDatabaseUrl(env);
  const hostname = new URL(databaseUrl).hostname.toLowerCase();
  return hostname.includes('cockroachlabs.cloud');
}
