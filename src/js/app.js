
import Vue from 'vue'

import VueResource from 'vue-resource'

Vue.use(VueResource);

Vue.component('preloader', require('./components/Preloader.vue'));


window.app = new Vue({
	el: '#app',
	compoonents:["preloader"],
	created(){
		this.db = openDatabase('test_db', '1.0', 'TestDB', 2 * 1024 * 1024);
		this.db.transaction(function (tx) {
		  tx.executeSql('DROP TABLE IF EXISTS stories');
		  tx.executeSql('DROP TABLE IF EXISTS words');
		  tx.executeSql('DROP TABLE IF EXISTS users');
		  tx.executeSql('CREATE TABLE IF NOT EXISTS stories (id,score,user,time,title)');
		  tx.executeSql('CREATE TABLE IF NOT EXISTS words (text)');
		  tx.executeSql('CREATE TABLE IF NOT EXISTS users (id,karma)');
		  tx.executeSql('DELETE FROM stories');
		  tx.executeSql('DELETE FROM words');
		  tx.executeSql('DELETE FROM users');
		},function(tx){console.log("ERROR",tx)});
	},
	data(){
		return {
			index:[],
			stories:[],
			db:null,
			top:[],
			selectedTop:"0",
			startWeek:moment().subtract(1, 'weeks').startOf('isoWeek'),
			endWeek:moment().subtract(1, 'weeks').endOf('isoWeek')
		}
	},
	watch:{
		selectedTop(value){
			if(value!="0"){
				this.processStories();
			}else{
				alert("Please select valid oprion.");
				this.top=[];
			}
		}
	},
	filters:{
		case(string){
			return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
		}
	},
	mounted(){
		this.loadIndex();
	},
	methods:{
		refresh(){
			this.loadIndex();
		},

		loadIndex(){
			this.$refs.preloader.visible=true;
			this.$refs.preloader.message="Loading Index";
			this.$http.get('https://hacker-news.firebaseio.com/v0/newstories.json?print=pretty').then(response => {
			   	this.index=response.body;
			   	var manifest=[];
			   	this.stories=[];
			   	this.db.transaction(function (tx) {
		  			tx.executeSql('DELETE FROM stories');
		  			tx.executeSql('DELETE FROM users');
		  			tx.executeSql('DELETE FROM words');

				});

			   	this.index.forEach(function(i){
			   		//if(manifest.length<10)
			   		   manifest.push({id:i,src:"https://hacker-news.firebaseio.com/v0/item/"+i+".json?print=pretty"});
			   	}.bind(this))
			   	
			   	this.fetchStories(manifest);
			  }, response => {
			    	console.log('error');
			  });
		},

		fetchStories(manifest){
			
			var db=this.db;
			var queue = new createjs.LoadQueue();

			var loaded=0;
			var $this=this;
			this.$refs.preloader.message="Loading Stories 0%";
		    queue.on("fileload", function(e){
		    		db.transaction(function (tx) {
			  			tx.executeSql('INSERT INTO stories (id,score,user,time,title) VALUES('+e.result.id+','+e.result.score+',"'+e.result.by+'",'+e.result.time+',"'+e.result.title+'")');
					},function(tx){console.log("DB error",tx);});
				loaded++;
		    	$this.$refs.preloader.message="Loading Stories: "+((loaded*100)/manifest.length).toFixed(1)+"%";
		  		
		    });
		    queue.on("complete", function(){
				console.log("Stories Complete");
				$this.$refs.preloader.message="Loading Stories Complete";
				this.fetchUsers();
			}, this);
		    
		    queue.loadManifest(manifest);
		},

		fetchUsers(){
			var db=this.db;
			var $this=this;
			this.$refs.preloader.message="Loading Users 0%";
			var queue = new createjs.LoadQueue();

			queue.on("fileload", function(e){
				
	    		db.transaction(function (tx) {
		  			tx.executeSql('INSERT INTO users (id,karma) VALUES("'+e.result.id+'",'+e.result.karma+')');
				},function(tx){console.log("DB error",tx);});
				loaded++;
		    	$this.$refs.preloader.message="Loading Users: "+((loaded*100)/userManifest.length).toFixed(1)+"%";
		  		
		    });

		    queue.on("complete", function(){
				console.log("complete users");
				$this.$refs.preloader.message="Loading Users Complete";
				this.processStories()
			}, this);

			var userManifest=[];
			var loaded=0;
			db.transaction(function(tx){
				tx.executeSql("SELECT user from stories group by user",[],function(tx,result){
					for(var i=0;i<result.rows.length;i++){
						userManifest.push({id:result.rows[i].user,src:"https://hacker-news.firebaseio.com/v0/user/"+result.rows[i].user+".json?print=pretty"});
					}
					queue.loadManifest(userManifest);

				});
			},function(tx){console.log("DB error",tx);}); 


			

		    

		},

		processStories(){
			if(this.selectedTop!=0){
				this.db.transaction(function (tx) {
		  			tx.executeSql('DELETE FROM words');
				},function(tx){console.log("ERROR",tx)});

				this.top=[];
				var sqlQuery="";
				if(this.selectedTop==1){
					sqlQuery="SELECT * FROM stories";
				}else if(this.selectedTop==2){
					sqlQuery="SELECT * FROM stories where time>="+app.startWeek.unix()+" AND time<="+app.endWeek.unix();
				}else if(this.selectedTop==3){
					sqlQuery="SELECT * FROM stories where user in (SELECT id FROM users where karma>10000)";
				}

				var db=this.db;
				var transactions=[];
				var $this=this;
				$this.$refs.preloader.message="Processing...";
				db.transaction(function (tx) {
					tx.executeSql(sqlQuery,[],function(tx,result){
						for(var i=0;i<result.rows.length;i++){
							var words=result.rows[i].title.split(' ');
							words.forEach(function(v){
								if(v.length>3) transactions.push('INSERT INTO words(text) VALUES("'+v.toUpperCase()+'")');
							});
							
						}
					});
				});
				db.transaction(function(tx){
					transactions.forEach(function(sql){
						tx.executeSql(sql)
					});
				});
				this.getTop();
			}else{
				this.$refs.preloader.visible=false; 
			}
		},

		getTop(){
			var $this=this;
			this.db.transaction(function(tx){
				tx.executeSql("SELECT text,count(*) as total from words group by text order by total desc",[],function(tx,result){
					$this.top=[];
					if(result.rows.length>0){
						var max=(result.rows.length<=10)?result.rows.length:10;
						for(var i=0; i<max;i++){
							$this.top.push(result.rows[i]);
						}
					}
				});
			},function(tx){
				console.log("DB error",tx);
			});
			this.$refs.preloader.visible=false;
		},

		get_stories(){
			this.db.transaction(function (tx) {
				tx.executeSql("SELECT * FROM stories",[],function(tx,result){
					console.log("Stories",result);
				});
			},function(tx){
				console.log("DB error",tx);
			});
		},
		get_users(){
			this.db.transaction(function (tx) {
				tx.executeSql("SELECT * FROM users",[],function(tx,result){
					console.log("Users",result);
				});
			},function(tx){
				console.log("DB error",tx);
			});
		},
		test(query){
			this.db.transaction(function (tx) {
				tx.executeSql(query,[],function(tx,result){
					console.log("Users",result);
				});
			},function(tx){
				console.log("DB error",tx); 
			});
		}


		
	}
});