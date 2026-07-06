with open("src/defaultNetwork.ts", "r") as f:
    content = f.read()

content = content.replace('name: "Indicator', 'full_name: "Indicator')
content = content.replace('dimension_id: 1,', 'dimension_id: "1",')
content = content.replace('dimension_id: 2,', 'dimension_id: "2",')
content = content.replace('dimension_id: 3,', 'dimension_id: "3",')
content = content.replace('dimension_id: 4,', 'dimension_id: "4",')

with open("src/defaultNetwork.ts", "w") as f:
    f.write(content)

