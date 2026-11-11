FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY DeltaTravel.AspNet.csproj ./
RUN dotnet restore DeltaTravel.AspNet.csproj
COPY . ./
RUN dotnet publish DeltaTravel.AspNet.csproj -c Release -o /publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /publish ./
ENV ASPNETCORE_URLS=http://+:10000
ENV ASPNETCORE_ENVIRONMENT=Production
USER $APP_UID
EXPOSE 10000
ENTRYPOINT ["dotnet", "DeltaTravel.AspNet.dll"]