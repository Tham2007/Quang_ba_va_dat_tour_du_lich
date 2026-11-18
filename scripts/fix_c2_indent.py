with open("scripts/chapter2_builder.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

new_lines = []
in_for = False
for i, line in enumerate(lines):
    # Fix for loop indentation around line 1438
    if "for code, name, img_name, desc, swimlanes, puml in activities:" in line:
        new_lines.append("    for code, name, img_name, desc, swimlanes, puml in activities:\n")
        in_for = True
        continue
    if in_for:
        if line.strip() == "":
            new_lines.append("\n")
            continue
        if line.startswith("    add_heading_3(doc, \"2.3.3: Class:"):
            in_for = False
            new_lines.append(line)
            continue
        # Indent lines inside for loop to 8 spaces
        new_lines.append("        " + line.strip() + "\n")
        continue
    new_lines.append(line)

with open("scripts/chapter2_builder.py", "w", encoding="utf-8") as f:
    f.writelines(new_lines)

print("Fixed for loop indentations in chapter2_builder.py!")
