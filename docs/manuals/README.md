# WeClaws Manuals

这里保存 WeClaws 的稳定参考文档。README 负责快速介绍项目，manuals 负责记录可验证的接口、部署、运行时和运维事实。

## 阅读路径

| 你想了解 | 建议阅读 |
| --- | --- |
| 如何部署和排障 Docker Compose | [docker-deployment-runbook.md](docker-deployment-runbook.md) |
| 环境变量、密钥边界和本地/Compose 配置差异 | [env-and-secrets-matrix.md](env-and-secrets-matrix.md) |
| Web API、SSE 和错误码 | [api-contract.md](api-contract.md) |
| FastAgent CLI 如何被 WeClaws 启动和消费 | [fastagent-cli-contract.md](fastagent-cli-contract.md) |
| remote sandbox 路径语义，`/workspace`、`/state` 和 `stateRoot` 的区别 | [sandbox-path-semantics.md](sandbox-path-semantics.md) |
| 官方托管技能的同步策略和当前清单 | [managed-skills.md](managed-skills.md) |
| SQLite 表结构、字段、索引和关系 | [database-schema-reference.md](database-schema-reference.md) |
| 数据库迁移约束和未来 PostgreSQL 迁移边界 | [database-migration-notes.md](database-migration-notes.md) |
| 当前关键版本基线 | [version-matrix.md](version-matrix.md) |

## 维护规则

- 文档中的事实应以代码、配置、Dockerfile、迁移和测试为准。
- 改动 FastAgent CLI、sandbox-runtime、Compose、环境变量或托管技能时，必须同步检查本目录相关手册。
- README 可以偏产品介绍；长期 contract、边界和排障信息应沉到 manuals。
