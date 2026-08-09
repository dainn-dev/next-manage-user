import org.flywaydb.core.internal.resource.StringResource;
import org.flywaydb.core.internal.resolver.ChecksumCalculator;
import java.nio.file.*;
public class FwCrc {
  public static void main(String[] args) throws Exception {
    for (String path : args) {
      String body = Files.readString(Path.of(path));
      int c = ChecksumCalculator.calculate(new StringResource(body));
      System.out.println(Path.of(path).getFileName() + " " + c);
    }
  }
}
