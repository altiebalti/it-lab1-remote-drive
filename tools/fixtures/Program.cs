using System;
using System.IO;
using System.Threading.Tasks;

namespace Drive.Client
{
    internal static class Program
    {
        private const string ApiBaseUrl = "http://localhost:3002/api";

        private static async Task Main(string[] args)
        {
            Console.WriteLine($"Підключення до {ApiBaseUrl}");

            var folder = args.Length > 0 ? args[0] : Directory.GetCurrentDirectory();
            foreach (var path in Directory.EnumerateFiles(folder))
            {
                var info = new FileInfo(path);
                Console.WriteLine($"  {info.Name,-24} {info.Length,8} Б  {info.CreationTime:dd.MM.yyyy HH:mm}");
            }

            await Task.CompletedTask;
        }
    }
}
