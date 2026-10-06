# Multicompêndio

Plataforma web para gerenciar múltiplos sistemas de RPG (Role Playing Game): cadastro de sistemas, configuração de atributos personalizados e, nas próximas etapas, personagens, itens, histórias de origem e exportação de fichas em PDF.


## Tecnologias

- **Front-end:** React, TypeScript, Vite
- **Back-end:** Node.js, Express, TypeScript
- **Banco de dados:** PostgreSQL


## Pré-requisitos

Instale antes de começar:

| Ferramenta | Versão | Download |
|---|---|---|
| Node.js | 18 ou superior | https://nodejs.org |
| PostgreSQL | 14 ou superior | https://www.postgresql.org/download |
| Git | qualquer recente | https://git-scm.com |

Para conferir o que já está instalado:

```bash
node -v
psql --version
git --version
```

> **Windows:** se o `psql` não for reconhecido no terminal, ele provavelmente está instalado mas fora do PATH. Você pode usar o caminho completo (ex.: `& 'C:\Program Files\PostgreSQL\18\bin\psql.exe'`) ou adicionar a pasta `bin` do PostgreSQL às variáveis de ambiente do sistema.

## Passo a passo

### 1. Baixar o projeto

```bash
git clone https://github.com/Tobias-Santos/Multicompendio.git
cd Multicompendio
```

### 2. Criar o banco de dados

Com o PostgreSQL rodando, crie o banco (vai pedir a senha do usuário `postgres` definida na instalação):

```bash
createdb -U postgres multicompendio
```

Em seguida, crie as tabelas e carregue o sistema pré-configurado. Rode os comandos a partir da pasta `multicompendio-backend`:

```bash
cd multicompendio-backend
psql -U postgres -d multicompendio -f sql/schema.sql
psql -U postgres -d multicompendio -f sql/seed.sql
```

> **Acentos aparecendo errados (Windows)?** Antes de rodar o `seed.sql`, execute `chcp 65001` no PowerShell, ou defina `$env:PGCLIENTENCODING="UTF8"`.
>
> Os arquivos de `sql/migrations/` **não** são necessários numa instalação nova — o `schema.sql` já está atualizado. Eles existem apenas para quem criou o banco numa versão antiga do projeto.

### 3. Configurar e rodar o back-end

Ainda dentro de `multicompendio-backend`:

```bash
npm install
```

Crie o arquivo `.env` a partir do exemplo:

```bash
# Linux / macOS
cp .env.example .env

# Windows (PowerShell)
copy .env.example .env
```

Abra o `.env` e ajuste a `DATABASE_URL` com o usuário, a senha e o nome do banco que você usou:

```env
PORT=3000
DATABASE_URL=postgres://postgres:SUA_SENHA@localhost:5432/multicompendio
```

Suba o servidor:

```bash
npm run dev
```

Se tudo estiver certo, o terminal mostra: `Multicompêndio API rodando na porta 3000`. Deixe esse terminal aberto.

### 4. Configurar e rodar o front-end

Abra **outro terminal**, volte à raiz do projeto e entre na pasta do front-end:

```bash
cd multicompendio-frontend
npm install
```

Crie o `.env`:

```bash
# Linux / macOS
cp .env.example .env

# Windows (PowerShell)
copy .env.example .env
```

O conteúdo padrão já funciona se o back-end estiver na porta 3000:

```env
VITE_API_URL=http://localhost:3000
```

Suba a interface:

```bash
npm run dev
```

### 5. Abrir no navegador

Acesse **http://localhost:5173**. Você deve ver a tela inicial com o sistema "Dungeons & Dragons 5e" já cadastrado.

## Scripts disponíveis

Em ambas as pastas (`multicompendio-backend` e `multicompendio-frontend`):

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe em modo de desenvolvimento, recarregando a cada alteração |
| `npm run build` | Gera a versão compilada |

## Problemas comuns

**`client password must be a string` ou `autenticação do tipo senha falhou` (back-end)**
O `.env` não existe ou a `DATABASE_URL` está com valores de exemplo. Confira o usuário e a senha, salve o arquivo e reinicie o `npm run dev`.

**`banco de dados "multicompendio" não existe`**
O banco ainda não foi criado. Volte ao passo 2.

**`Failed to fetch` na interface**
O back-end não está rodando ou está em outra porta. Confira se o terminal do back-end mostra a mensagem de API rodando e se o `VITE_API_URL` aponta para a porta correta.

**`psql` não é reconhecido (Windows)**
Use o caminho completo do executável ou adicione a pasta `bin` do PostgreSQL ao PATH e abra um terminal novo.

**`ERESOLVE` ao rodar `npm install` no front-end**
Apague a pasta `node_modules` e o arquivo `package-lock.json` e rode `npm install` novamente. Em último caso, use `npm install --legacy-peer-deps`.

**Acentos corrompidos no sistema pré-configurado**
Veja a observação de codificação no passo 2. Para corrigir um banco já populado:

```bash
psql -U postgres -d multicompendio -c "DELETE FROM rpg_systems WHERE is_preconfigured = TRUE;"
psql -U postgres -d multicompendio -f sql/seed.sql
```