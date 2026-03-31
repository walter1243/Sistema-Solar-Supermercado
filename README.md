# Solar Supermercado

Aplicativo web mobile-first para vendas pelo Instagram com:

- landing page
- loja com checkout em etapas
- painel administrativo
- autenticação de cliente com cashback
- controle de pedidos e entregas

## Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- Framer Motion
- Vercel

## Executar localmente

```bash
npm install
npm run dev
```

## Build de produção

```bash
npm run build
```

## Variáveis de ambiente

Defina a URL do backend Flask em `.env.local`:

```bash
NEXT_PUBLIC_API_BASE_URL=https://seu-backend-flask.com
```

Sem essa variável, o frontend continua funcionando com cache local para contingência.

## Contrato esperado do Flask

O frontend agora trabalha em modo remoto-primeiro e tenta estas rotas:

### Produtos

- `GET /products` ou `GET /api/products`
- `POST /products` ou `POST /api/products`

### Configurações administrativas

- `GET /settings` ou `GET /admin/settings` ou equivalentes em `/api/...`
- `PUT /settings` ou `PUT /admin/settings` ou equivalentes em `/api/...`

Payload esperado:

```json
{
	"pixKey": "chave-pix",
	"whatsappNumber": "11999999999",
	"categories": ["Mercearia", "Carnes", "Bebidas"]
}
```

### Clientes

- `POST /customers/register`
- `POST /customers/login`
- `PUT /customers/:id`

Payload esperado:

```json
{
	"id": "uuid",
	"fullName": "Cliente Solar",
	"phone": "11999999999",
	"cpf": "00000000000",
	"password": "123456",
	"street": "Rua A",
	"number": "10",
	"reference": "Prox. a praca",
	"cashbackBalance": 0
}
```

### Pedidos

- `GET /orders`
- `POST /orders`
- `PATCH /orders/:id/status`
- `GET /deliveries` opcional

Payload de pedido:

```json
{
	"id": "uuid",
	"items": [
		{
			"productId": "uuid",
			"name": "Arroz Tipo 1 - 5kg",
			"quantity": 2,
			"unitPrice": 32.9
		}
	],
	"customer": {
		"fullName": "Cliente Solar",
		"cpf": "00000000000",
		"phone": "11999999999",
		"address": "Rua A | N 10 | Ref: Praca",
		"street": "Rua A",
		"number": "10",
		"reference": "Praca"
	},
	"total": 65.8,
	"status": "novo",
	"paymentMethod": "pix",
	"fulfillmentMethod": "entrega",
	"paymentConfirmed": false,
	"customerId": "uuid",
	"createdAt": "2026-03-31T12:00:00.000Z"
}
```

Payload para atualização de status:

```json
{
	"status": "em_rota",
	"paymentConfirmed": true
}
```

### Dashboard

- `GET /dashboard` ou `GET /api/dashboard`

Retorno esperado:

```json
{
	"revenueToday": 0,
	"ordersToday": 0,
	"productsToday": 0,
	"totalProducts": 0
}
```

## Observação operacional

Se o backend responder objetos embrulhados como `{ "data": ... }` ou listas em `{ "items": [...] }`, o frontend já trata isso.
