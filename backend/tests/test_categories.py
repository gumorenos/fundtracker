def test_list_categories(client, auth_headers):
    r = client.get("/categories", headers=auth_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_create_category_admin(client, auth_headers):
    r = client.post("/categories", json={"name": "Test", "color": "#123456"}, headers=auth_headers)
    assert r.status_code == 201
    assert r.json()["name"] == "Test"


def test_create_category_viewer_forbidden(client, viewer_headers):
    r = client.post("/categories", json={"name": "X"}, headers=viewer_headers)
    assert r.status_code == 403


def test_update_category(client, auth_headers):
    create = client.post("/categories", json={"name": "Old", "color": "#aaaaaa"}, headers=auth_headers)
    cat_id = create.json()["id"]
    r = client.put(f"/categories/{cat_id}", json={"name": "New"}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["name"] == "New"


def test_delete_category(client, auth_headers):
    create = client.post("/categories", json={"name": "ToDelete"}, headers=auth_headers)
    cat_id = create.json()["id"]
    r = client.delete(f"/categories/{cat_id}", headers=auth_headers)
    assert r.status_code == 204
