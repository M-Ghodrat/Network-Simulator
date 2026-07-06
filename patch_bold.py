with open("src/components/LearnPage.tsx", "r") as f:
    content = f.read()

content = content.replace("**Graph**", "<strong>Graph</strong>")
content = content.replace("**Nodes**", "<strong>Nodes</strong>")
content = content.replace("**Edges**", "<strong>Edges</strong>")
content = content.replace("**Urban Resilience**", "<strong>Urban Resilience</strong>")

with open("src/components/LearnPage.tsx", "w") as f:
    f.write(content)
