<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // X-Forwarded-For принимаем только от прокси из частных сетей (в dev — контейнер frontend с Vite).
        // ponytail: в dev клиент с частного адреса может подделать заголовок и обойти лимит;
        // в проде здесь только адрес балансировщика.
        $middleware->trustProxies(at: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Ответы /api/* — всегда JSON, даже без Accept: application/json
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Русские сообщения вместо стандартных; заголовки (Retry-After) сохраняем
        $exceptions->render(fn (ThrottleRequestsException $e, Request $request) => $request->is('api/*')
            ? response()->json(['message' => 'Слишком много запросов. Попробуйте через минуту.'], 429, $e->getHeaders())
            : null);

        // Без имени класса модели, которое Laravel показал бы по умолчанию
        $exceptions->render(fn (NotFoundHttpException $e, Request $request) => $request->is('api/*')
            ? response()->json(['message' => 'Не найдено.'], 404)
            : null);
    })->create();
