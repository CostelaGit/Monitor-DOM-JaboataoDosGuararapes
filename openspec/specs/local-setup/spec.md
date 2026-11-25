# local-setup Specification

## Purpose

Garante que a configuração de ambiente local do Monitor DOM de Jaboatão dos Guararapes funcione de forma determinística e sem falhas de variável de ambiente ausente ao inicializar o banco de dados local ou iniciar a aplicação.

## Requirements

### Requirement: Fallback local seguro para URL do banco de dados
O sistema SHALL utilizar o caminho padrão do banco local SQLite (`file:./dev.db`) quando a variável de ambiente `DATABASE_URL` não estiver definida durante a inicialização em ambiente de desenvolvimento ou teste local.

#### Scenario: Inicialização do cliente de banco sem arquivo .env
- **WHEN** a aplicação ou script CLI é iniciado localmente sem `DATABASE_URL` definida no ambiente
- **THEN** o sistema define `DATABASE_URL` com o valor padrão `file:./dev.db` antes de inicializar a conexão com o banco de dados

#### Scenario: Preservação de DATABASE_URL explícita
- **WHEN** `DATABASE_URL` já está definida no ambiente ou no arquivo `.env`
- **THEN** o sistema utiliza o valor configurado sem sobrescrevê-lo

### Requirement: Guia e comando de preparação do ambiente local
O projeto SHALL documentar todas as etapas obrigatórias de configuração local (incluindo a criação do arquivo `.env` a partir de `.env.example`) e disponibilizar um script de preparação que inicialize o `.env` e o schema do banco local.

#### Scenario: Execução do fluxo documentado no README do pacote
- **WHEN** um desenvolvedor segue as instruções de execução local em `dom-jaboatao-monitor/README.md` em um clone limpo
- **THEN** o arquivo `.env` é criado a partir de `.env.example` e o banco SQLite local é criado antes da sincronização e do servidor de desenvolvimento
