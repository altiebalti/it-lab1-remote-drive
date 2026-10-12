using System;
using System.Collections.Generic;
using System.Linq;

namespace Drive.Client
{
    public sealed class FileService
    {
        private static readonly string[] VariantFilterExtensions = { ".xml", ".png" };

        public IReadOnlyList<FileRecord> Apply(
            IEnumerable<FileRecord> files, bool onlyVariantTypes, bool ascending)
        {
            var query = files.AsEnumerable();

            if (onlyVariantTypes)
            {
                query = query.Where(f =>
                    VariantFilterExtensions.Contains(f.Extension, StringComparer.OrdinalIgnoreCase));
            }

            query = ascending
                ? query.OrderBy(f => f.CreatedAt).ThenBy(f => f.Name)
                : query.OrderByDescending(f => f.CreatedAt).ThenBy(f => f.Name);

            return query.ToList();
        }
    }
}
