def test_summary_returns_expected_fields(client, auth_headers):
    r = client.get("/summary", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert "saldo_actual_usd" in data
    assert "gasto_total_usd" in data
    assert "gasto_mes_actual_usd" in data
    assert "gasto_promedio_diario_usd" in data
    assert "dias_desde_inicio" in data
    assert "proyeccion_agotamiento" in data
    assert "proyeccion_dias_restantes" in data


def test_summary_initial_balance(client, auth_headers):
    r = client.get("/summary", headers=auth_headers)
    assert float(r.json()["saldo_actual_usd"]) == 30000.0
    assert float(r.json()["gasto_total_usd"]) == 0.0


def test_projection_params(client, auth_headers):
    r = client.get("/projection-params", headers=auth_headers)
    assert r.status_code == 200
    assert "adjustment_percentage" in r.json()


def test_update_projection_params(client, auth_headers):
    r = client.put(
        "/projection-params",
        json={"adjustment_percentage": "10.00", "notes": "Inflation adjustment"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    assert r.json()["adjustment_percentage"] == "10.00"
