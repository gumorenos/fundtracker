def _get_category_id(client, headers):
    cats = client.get("/categories", headers=headers).json()
    return cats[0]["id"]


def test_create_transaction(client, auth_headers):
    cat_id = _get_category_id(client, auth_headers)
    r = client.post(
        "/transactions",
        json={"amount_usd": "50.00", "category_id": cat_id, "description": "Test"},
        headers=auth_headers,
    )
    assert r.status_code == 201
    assert r.json()["amount_usd"] == "50.00"


def test_create_transaction_with_pen(client, auth_headers):
    cat_id = _get_category_id(client, auth_headers)
    r = client.post(
        "/transactions",
        json={
            "amount_usd": "20.00",
            "amount_pen": "76.00",
            "exchange_rate": "3.8000",
            "category_id": cat_id,
        },
        headers=auth_headers,
    )
    assert r.status_code == 201
    assert r.json()["exchange_rate"] == "3.8000"


def test_list_transactions(client, auth_headers):
    cat_id = _get_category_id(client, auth_headers)
    client.post("/transactions", json={"amount_usd": "10.00", "category_id": cat_id}, headers=auth_headers)
    r = client.get("/transactions", headers=auth_headers)
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_get_transaction(client, auth_headers):
    cat_id = _get_category_id(client, auth_headers)
    create = client.post(
        "/transactions", json={"amount_usd": "15.00", "category_id": cat_id}, headers=auth_headers
    )
    tx_id = create.json()["id"]
    r = client.get(f"/transactions/{tx_id}", headers=auth_headers)
    assert r.status_code == 200


def test_delete_transaction_admin(client, auth_headers):
    cat_id = _get_category_id(client, auth_headers)
    create = client.post(
        "/transactions", json={"amount_usd": "5.00", "category_id": cat_id}, headers=auth_headers
    )
    tx_id = create.json()["id"]
    r = client.delete(f"/transactions/{tx_id}", headers=auth_headers)
    assert r.status_code == 204


def test_delete_transaction_viewer_forbidden(client, auth_headers, viewer_headers):
    cat_id = _get_category_id(client, auth_headers)
    create = client.post(
        "/transactions", json={"amount_usd": "5.00", "category_id": cat_id}, headers=auth_headers
    )
    tx_id = create.json()["id"]
    r = client.delete(f"/transactions/{tx_id}", headers=viewer_headers)
    assert r.status_code == 403


def test_balance_decreases_on_transaction(client, auth_headers):
    before = client.get("/summary", headers=auth_headers).json()["saldo_actual_usd"]
    cat_id = _get_category_id(client, auth_headers)
    client.post("/transactions", json={"amount_usd": "100.00", "category_id": cat_id}, headers=auth_headers)
    after = client.get("/summary", headers=auth_headers).json()["saldo_actual_usd"]
    assert float(after) == float(before) - 100.0
