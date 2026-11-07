<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    // Notifications de l'utilisateur connecté (les plus récentes d'abord) + nombre de non lues
    public function index(Request $request)
    {
        $user = $request->user();
        $page = $user->notifications()->paginate(15);

        return response()->json(array_merge($page->toArray(), [
            'non_lues' => $user->unreadNotifications()->count(),
        ]));
    }

    public function nonLues(Request $request)
    {
        return response()->json(['non_lues' => $request->user()->unreadNotifications()->count()]);
    }

    public function lire(Request $request, string $id)
    {
        // findOrFail sur les notifications de l'utilisateur : on ne peut pas lire celles d'un autre
        $request->user()->notifications()->findOrFail($id)->markAsRead();

        return response()->json(['non_lues' => $request->user()->unreadNotifications()->count()]);
    }

    public function toutLire(Request $request)
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return response()->json(['non_lues' => 0]);
    }
}
