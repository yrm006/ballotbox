//% deno run --allow-net --allow-read --allow-write back.js
import { Application, Router, send } from "https://deno.land/x/oak/mod.ts";
import { DB } from "https://deno.land/x/sqlite/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";
import { decode as base64decode } from "https://deno.land/std/encoding/base64.ts";



async function doAuth(ctx, next){
    let authed = false;{
        const auth = ctx.request.headers.get("Authorization");
        if(auth){
            const userpass = (new TextDecoder().decode(base64decode( auth.split(" ")[1] ))).split(":");
            authed = ( userpass[0]==="kani" && userpass[1]==="robo" );
        }
    }

    if(authed){
        await next();
    }else{
        ctx.response.status = 401;
        ctx.response.headers.set("WWW-Authenticate", 'Basic');
    }
}

const router = new Router();{
    router.get('/photo/:id-:filename', async function(ctx){
        await send(ctx, `${ctx.params.id}-${ctx.params.filename}`, {
            root: './entry-photo',
        });
    });

    router.get('/video/:id-:filename', async function(ctx){
        await send(ctx, `${ctx.params.id}-${ctx.params.filename}`, {
            root: './entry-video',
        });
    });

    router.get("/entries", async function(ctx){
        let r = null;
        const db = new DB("_.db");{
            r = db.queryEntries("select id,sTitle,sComment,sPhotoFile,sVideoFile,(select count(*) from TBallot where pEntry=TEntry.id) as nBallots,(select count(*) from TBallot where pEntry=TEntry.id and sEmail is not NULL) as nBallotsM from TEntry order by nBallots DESC");
            db.close();
        }
        ctx.response.body = r;
    });

    router.get("/delete", async function(ctx){
        const id = ctx.request.url.searchParams.get("id");

        const db = new DB("_.db");{
            db.query("delete from TEntry where id=?", [id]);
            db.close();
        }

        ctx.response.redirect("/");
    });

    router.post("/entry", async function(ctx){
        const body = await ctx.request.body({ type: 'form-data'});
        const form = await body.value.read({ maxFileSize: 104_857_600});
        const v = form.fields;

        const db = new DB("_.db");
        db.query("BEGIN");
        try{
            db.query("INSERT INTO TEntry (sTitle,sComment) VALUES (?,?)", [v.sTitle, v.sComment]);

            const id = db.lastInsertRowId;

            for(const f of form.files){
                if(f.name === "fPhoto"){
                    Deno.renameSync(f.filename, `./entry-photo/${id}-${f.originalName}`);
                    db.query("UPDATE TEntry set sPhotoFile=? where id=?", [f.originalName, id]);
                }else
                if(f.name === "fVideo"){
                    Deno.renameSync(f.filename, `./entry-video/${id}-${f.originalName}`);
                    db.query("UPDATE TEntry set sVideoFile=? where id=?", [f.originalName, id]);
                }else
                {}
            }

            db.query("COMMIT");
        }catch(e){
            ctx.response.body = `check your some inputs.(${e})`;
            return;
        }

        ctx.response.redirect("/");



        // let r = null;
        // let id = Number.parseInt(ctx.request.url.searchParams.get("id"));
        // const db = new DB("_.db");{
        //     r = db.queryEntries("select id,sName,nAge,sCode,sClass,sTitle,sPR,sThumbFile,sVideoFile,sSourceFile,datetime(dCreated,'+9 hours') as dCreatedJST from TEntry where id=?", [id]);
        //     db.close();
        // }
        // ctx.response.body = r[0];
    });
}

const app = new Application();{
    const port = 8111;

    app.use(async function(ctx, next){
                                                                        console.log(`--- ${new Date()} - ${ctx.request.method} ${ctx.request.url.pathname}`);
        await next();
    });
    app.use(doAuth);
    app.use(oakCors());
    app.use(router.routes());
    app.use(router.allowedMethods());
    app.use(async function(ctx){
        try{
            await send(ctx, ctx.request.url.pathname, {
                root: './www-back',
                index: "index.html",
            });
        }catch(e){}
    });
                                                                        console.log('running on port ', port);
    await app.listen({
        port: port,
        // secure: true,
        // certFile: "server_crt.pem",
        // keyFile: "server_key.pem",
    });
}


