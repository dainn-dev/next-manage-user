from pathlib import Path

Path("artifacts/FwCrc.java").write_text(
    "\n".join(
        [
            "import org.flywaydb.core.internal.resource.StringResource;",
            "import org.flywaydb.core.internal.resolver.ChecksumCalculator;",
            "import java.nio.file.*;",
            "public class FwCrc {",
            "  public static void main(String[] args) throws Exception {",
            "    for (String path : args) {",
            "      String body = Files.readString(Path.of(path));",
            "      int c = ChecksumCalculator.calculate(new StringResource(body));",
            '      System.out.println(Path.of(path).getFileName() + " " + c);',
            "    }",
            "  }",
            "}",
            "",
        ]
    ),
    encoding="utf-8",
)
# strip BOM if any
raw = Path("artifacts/FwCrc.java").read_bytes()
if raw.startswith(b"\xef\xbb\xbf"):
    Path("artifacts/FwCrc.java").write_bytes(raw[3:])
print("wrote", Path("artifacts/FwCrc.java").stat().st_size)
