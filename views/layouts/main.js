<!doctype html><html><head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css?family=Roboto" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<link href="/css/style.css" rel="stylesheet">
<script src="https://kit.fontawesome.com/a076d05399.js"></script>
<title><%= title %> • DrakorFlow</title>
</head><body class="font-roboto">
<nav class="navbar navbar-expand bg-primary text-white">
  <a class="nav-brand ms-3">DrakorFlow</a>
  <div class="ms-auto me-3"><%= user?user.username+' ('+user.role+')':'' %> <a class="btn btn-sm btn-outline-light" href="/logout">Logout</a></div>
</nav>
<main class="p-4"><%- body %></main>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
</body></html>
